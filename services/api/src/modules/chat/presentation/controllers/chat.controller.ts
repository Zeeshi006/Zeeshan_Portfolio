import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import * as nodeCrypto from "crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { AnswerQuestionUseCase } from "../../application/use-cases/answer-question.use-case";
import { SpendGuardService } from "../../application/services/spend-guard.service";
import { RateLimitService } from "../../application/services/rate-limit.service";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { AskDto, ChatResponseDto, FeedbackDto } from "../dtos/chat.dto";
import { SaveVoiceTranscriptDto } from "../dtos/conversation.dto";
import { ILLMProvider, LLM_PROVIDER } from "../../domain/ports/llm-provider.port";

const DAILY_LIMIT_MESSAGE =
  "I've helped a lot of visitors today! For more about Hammad's work, reach him directly at hammad.afzal.code@gmail.com or via WhatsApp.";

const RATE_LIMIT_MESSAGE =
  "You've sent quite a few messages — give it a moment, then ask away. Or reach Hammad directly at hammad.afzal.code@gmail.com";

const SESSION_COOKIE = "chat_session";

function makeTranscriptToken(conversationId: string, secret: string): string {
  return nodeCrypto
    .createHmac("sha256", secret)
    .update(conversationId)
    .digest("hex");
}

const VOICE_SUMMARY_PROMPT = `You are summarizing a voice portfolio call for the portfolio owner's admin dashboard.
Write exactly 2-3 sentences covering: (1) what the visitor was most interested in, (2) any specific projects or topics discussed, (3) whether they expressed hiring intent or next steps.
Be factual and direct. No filler phrases.`;

@ApiTags("chat")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly answerQuestion: AnswerQuestionUseCase,
    private readonly prisma: PrismaService,
    private readonly spendGuard: SpendGuardService,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  @Get("health")
  @ApiOkResponse({ schema: { example: { ok: true } } })
  health(): { ok: boolean } {
    return { ok: true };
  }

  // ── Standard (non-streaming) endpoint ────────────────────────────────────────

  @Post()
  @ApiOkResponse({ type: ChatResponseDto })
  async ask(
    @Body() dto: AskDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChatResponseDto> {
    const sessionId = this.resolveSessionId(req);
    this.setSessionCookie(res, sessionId);

    const rawIp = req.ip ?? "0.0.0.0";
    const ipHash = nodeCrypto
      .createHash("sha256")
      .update(rawIp)
      .digest("hex")
      .slice(0, 16);

    if (await this.spendGuard.isDailyLimitExceeded()) {
      return gracefulLimit(DAILY_LIMIT_MESSAGE);
    }

    const { allowed, limitType } = await this.rateLimit.checkAndRecord(
      rawIp,
      sessionId,
    );
    if (!allowed)
      return gracefulLimit(RATE_LIMIT_MESSAGE, limitType ?? undefined);

    const analyticsSessionId = dto.sessionId ?? undefined;
    const result = await this.answerQuestion.execute(
      dto.query,
      dto.history ?? [],
      analyticsSessionId,
    );

    this.persistConversation(sessionId, ipHash, dto.query, result).catch(
      () => {},
    );
    this.logQueryEvent(sessionId, dto.query, result).catch(() => {});

    return result;
  }

  // ── SSE streaming endpoint ────────────────────────────────────────────────────

  @Post("stream")
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async stream(
    @Body() dto: AskDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const sessionId = this.resolveSessionId(req);
    this.setSessionCookie(res, sessionId);

    const rawIp = req.ip ?? "0.0.0.0";
    const ipHash = nodeCrypto
      .createHash("sha256")
      .update(rawIp)
      .digest("hex")
      .slice(0, 16);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (await this.spendGuard.isDailyLimitExceeded()) {
      send({ token: DAILY_LIMIT_MESSAGE });
      send({ done: true, sources: [] });
      res.end();
      return;
    }

    const { allowed } = await this.rateLimit.checkAndRecord(rawIp, sessionId);
    if (!allowed) {
      send({ token: RATE_LIMIT_MESSAGE });
      send({ done: true, sources: [] });
      res.end();
      return;
    }

    // Capture streaming output so we can persist the conversation after it ends
    let fullAnswer = "";
    let sources: { id: string; title: string }[] = [];
    let toolCalls: { name: string; args: Record<string, unknown> }[] = [];

    try {
      for await (const event of this.answerQuestion.streamExecute(
        dto.query,
        dto.history ?? [],
        dto.sessionId ?? undefined,
      )) {
        send(event);
        if (event.token) fullAnswer += event.token;
        if (event.sources) sources = event.sources;
        if (event.toolCalls) toolCalls = event.toolCalls;
      }
    } catch {
      send({ error: true });
    }

    if (!res.writableEnded) res.end();

    // Persist after the stream closes — fire-and-forget
    if (fullAnswer) {
      const result = { answer: fullAnswer, sources, toolCalls };
      this.persistConversation(sessionId, ipHash, dto.query, result).catch(
        () => {},
      );
      this.logQueryEvent(sessionId, dto.query, result).catch(() => {});
    }
  }

  // ── Admin-only test endpoint (bypasses rate limiting) ─────────────────────────

  @Post("test")
  @UseGuards(JwtAuthGuard)
  @ApiExcludeEndpoint()
  async test(@Body() dto: AskDto): Promise<ChatResponseDto> {
    const result = await this.answerQuestion.execute(
      dto.query,
      dto.history ?? [],
      undefined,
    );
    return result;
  }

  // ── Visitor feedback on an answer ─────────────────────────────────────────────

  @Post("feedback")
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async feedback(
    @Body() dto: FeedbackDto,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    const sessionId =
      dto.sessionId ??
      (req.cookies as Record<string, string>)?.[SESSION_COOKIE] ??
      "unknown";
    await this.prisma.analyticsEvent
      .create({
        data: {
          type: "chat_feedback",
          path: "/chat",
          sessionId,
          metadata: {
            messageContent: dto.messageContent?.slice(0, 500) ?? "",
            thumbsUp: dto.thumbsUp ?? null,
          },
        },
      })
      .catch(() => {});
    return { ok: true };
  }

  // ── Issue a short-lived HMAC token so the transcript endpoint can verify
  //    that the POST came from a genuine ElevenLabs call started on this site. ──

  @Post("transcript-token")
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async transcriptToken(
    @Body() body: { conversationId: string },
  ): Promise<{ token: string }> {
    const secret = this.config.get<string>("TRANSCRIPT_SECRET")!;
    return { token: makeTranscriptToken(body.conversationId, secret) };
  }

  // ── Voice transcript ingest (called from browser after ElevenLabs call ends) ──

  @Post("transcript")
  @HttpCode(HttpStatus.CREATED)
  @ApiExcludeEndpoint()
  async saveVoiceTranscript(
    @Body() dto: SaveVoiceTranscriptDto,
  ): Promise<{ ok: boolean }> {
    const secret = this.config.get<string>("TRANSCRIPT_SECRET")!;
    const expected = makeTranscriptToken(dto.conversationId, secret);
    if (!nodeCrypto.timingSafeEqual(Buffer.from(dto.token), Buffer.from(expected))) {
      throw new ForbiddenException("Invalid transcript token");
    }
    const ipHash = nodeCrypto
      .createHash("sha256")
      .update("voice:" + dto.conversationId)
      .digest("hex")
      .slice(0, 16);

    const session = await this.prisma.chatSession.upsert({
      where: { sessionId: "voice:" + dto.conversationId },
      create: {
        sessionId: "voice:" + dto.conversationId,
        ipHash,
        type: "voice",
        voiceConversationId: dto.conversationId,
      },
      update: { updatedAt: new Date() },
    });

    // Atomic: delete old messages and create new ones in a single transaction
    if (dto.turns.length > 0) {
      await this.prisma.$transaction([
        this.prisma.chatMessage.deleteMany({
          where: { sessionId: session.id },
        }),
        this.prisma.chatMessage.createMany({
          data: dto.turns.map((turn) => ({
            sessionId: session.id,
            role: turn.role === "agent" ? "assistant" : "user",
            content: turn.message,
            sources: [],
            toolCalls: [],
            fromCache: false,
          })),
        }),
      ]);

      // Generate AI summary fire-and-forget (non-blocking)
      this.generateVoiceSummary(session.id, dto.turns).catch(() => {});
    } else {
      await this.prisma.chatMessage.deleteMany({
        where: { sessionId: session.id },
      });
    }

    return { ok: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private resolveSessionId(req: Request): string {
    return (
      (req.cookies as Record<string, string>)?.[SESSION_COOKIE] ??
      generateSessionId()
    );
  }

  private setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private async persistConversation(
    sessionId: string,
    ipHash: string,
    query: string,
    result: ChatResponseDto,
  ): Promise<void> {
    const session = await this.prisma.chatSession.upsert({
      where: { sessionId },
      create: { sessionId, ipHash, type: "text" },
      update: { updatedAt: new Date() },
    });

    await this.prisma.chatMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: "user",
          content: query,
          sources: [],
          toolCalls: [],
          fromCache: false,
        },
        {
          sessionId: session.id,
          role: "assistant",
          content: result.answer,
          sources: result.sources as object[],
          toolCalls: result.toolCalls as object[],
          fromCache: false,
        },
      ],
    });
  }

  private async logQueryEvent(
    sessionId: string,
    query: string,
    result: ChatResponseDto,
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: {
        type: "chatbot_query",
        path: "/chat",
        sessionId,
        metadata: {
          query,
          answerLength: result.answer.length,
          toolCallCount: result.toolCalls.length,
        },
      },
    });
  }

  private async generateVoiceSummary(
    sessionId: string,
    turns: { role: "user" | "agent"; message: string }[],
  ): Promise<void> {
    const transcript = turns
      .map((t) => `${t.role === "agent" ? "AI" : "Visitor"}: ${t.message}`)
      .join("\n");

    const messages = [{ role: "user" as const, content: `Transcript:\n${transcript}` }];
    const { content } = await this.llm.chatWithTools(messages, VOICE_SUMMARY_PROMPT, []);
    if (content.trim()) {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { summary: content.trim().slice(0, 1000) },
      });
    }
  }
}

function gracefulLimit(message: string, _limitType?: string): ChatResponseDto {
  return { answer: message, sources: [], toolCalls: [] };
}

function generateSessionId(): string {
  return nodeCrypto.randomBytes(16).toString("hex");
}
