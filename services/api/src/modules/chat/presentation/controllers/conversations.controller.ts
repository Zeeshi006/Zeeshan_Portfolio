import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { SpendGuardService } from '../../application/services/spend-guard.service';
import {
  ConversationDetailDto,
  ConversationsListDto,
} from '../dtos/conversation.dto';

class AddBlocklistDto {
  @ApiProperty({ example: '1.2.3.4' })
  @IsString()
  @IsNotEmpty()
  ip!: string;
}

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ConversationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spendGuard: SpendGuardService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── List conversations ──────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOkResponse({ type: ConversationsListDto })
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: string,
    @Query('search') search?: string,
  ): Promise<ConversationsListDto> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (type === 'text' || type === 'voice') where['type'] = type;

    if (search) {
      where['messages'] = {
        some: { content: { contains: search, mode: 'insensitive' } },
      };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatSession.count({ where }),
    ]);

    return {
      data: sessions.map((s) => ({
        id: s.id,
        sessionId: s.sessionId.slice(0, 8) + '…',
        ipHash: s.ipHash,
        type: s.type,
        messageCount: s._count.messages,
        firstMessage: s.messages[0]?.content.slice(0, 120) ?? '',
        summary: s.summary ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  // ── Single conversation ─────────────────────────────────────────────────────

  @Get('conversations/:id')
  @ApiOkResponse({ type: ConversationDetailDto })
  async detail(@Param('id') id: string): Promise<ConversationDetailDto> {
    const session = await this.prisma.chatSession.findUniqueOrThrow({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return {
      id: session.id,
      sessionId: session.sessionId,
      ipHash: session.ipHash,
      type: session.type,
      voiceConversationId: session.voiceConversationId,
      summary: session.summary ?? null,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources as unknown[],
        toolCalls: m.toolCalls as unknown[],
        fromCache: m.fromCache,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  // ── Flag / unflag a session ─────────────────────────────────────────────────

  @Patch('conversations/:id/flag')
  @HttpCode(HttpStatus.OK)
  async flag(
    @Param('id') id: string,
    @Body() body: { flagged: boolean },
  ): Promise<{ ok: boolean }> {
    await this.prisma.chatSession.update({
      where: { id },
      data: { flagged: body.flagged ?? true },
    });
    return { ok: true };
  }

  // ── Stats for admin overview ────────────────────────────────────────────────

  @Get('conversations-stats')
  async stats(): Promise<{
    todayTotal: number;
    todayText: number;
    todayVoice: number;
    allTimeTotal: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayText, todayVoice, allTimeTotal] = await Promise.all([
      this.prisma.chatSession.count({ where: { type: 'text', createdAt: { gte: todayStart } } }),
      this.prisma.chatSession.count({ where: { type: 'voice', createdAt: { gte: todayStart } } }),
      this.prisma.chatSession.count(),
    ]);

    return { todayTotal: todayText + todayVoice, todayText, todayVoice, allTimeTotal };
  }

  // ── Spend dashboard ─────────────────────────────────────────────────────────

  @Get('spend')
  async spend(): Promise<{
    todayUsd: number;
    ceilingUsd: number;
    percentUsed: number;
    last30DaysUsd: number[];
  }> {
    const todayUsd = await this.spendGuard.getDailySpend();
    const ceilingUsd = this.spendGuard.getDailyCeiling();

    // Fetch last 30 days of spend from Redis (today is the last element)
    const now = new Date();
    const keys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      keys.push(`spend:${yyyy}-${mm}-${dd}`);
    }
    const raws = await this.redis.mget(...keys);
    const last30DaysUsd = raws.map((r) => (r ? parseFloat(r) : 0));

    return {
      todayUsd,
      ceilingUsd,
      percentUsed: ceilingUsd > 0 ? Math.min(100, (todayUsd / ceilingUsd) * 100) : 0,
      last30DaysUsd,
    };
  }

  // ── IP Blocklist management ─────────────────────────────────────────────────

  @Get('blocklist')
  async getBlocklist(): Promise<{ ips: string[] }> {
    const ips = await this.redis.smembers('blocklist');
    return { ips };
  }

  @Post('blocklist')
  @HttpCode(HttpStatus.OK)
  async addToBlocklist(@Body() dto: AddBlocklistDto): Promise<{ ok: boolean }> {
    await this.redis.sadd('blocklist', dto.ip);
    return { ok: true };
  }

  @Delete('blocklist/:ip')
  @HttpCode(HttpStatus.OK)
  async removeFromBlocklist(@Param('ip') ip: string): Promise<{ ok: boolean }> {
    await this.redis.srem('blocklist', ip);
    return { ok: true };
  }

  // ── Most-asked questions ────────────────────────────────────────────────────

  @Get('top-queries')
  async topQueries(@Query('limit') limit = '20'): Promise<{ query: string; count: number }[]> {
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);

    const events = await this.prisma.analyticsEvent.findMany({
      where: { type: 'chatbot_query' },
      select: { metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 5000, // sample last 5k events
    });

    const counts: Map<string, number> = new Map();
    for (const e of events) {
      const meta = e.metadata as Record<string, unknown>;
      const q = typeof meta.query === 'string' ? meta.query.toLowerCase().trim() : null;
      if (q) counts.set(q, (counts.get(q) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitNum)
      .map(([query, count]) => ({ query, count }));
  }
}
