import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { IngestDocumentUseCase } from '../../application/use-cases/ingest-document.use-case';
import { IKBRepository, KB_REPOSITORY } from '../../domain/ports/kb-repository.port';
import { KBDocument } from '../../domain/entities/kb-document.entity';
import { CreateKBDocumentDto, KBDocumentResponseDto, KBAnalyticsItemDto, UpdateKBDocumentDto } from '../dtos/chat.dto';
import { IVoiceKBSync, VOICE_KB_SYNC } from '../../domain/ports/voice-kb-sync.port';
import { VoiceAlertService, ElevenLabsSubscription } from '../../application/services/voice-alert.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { KB_EMBED_QUEUE, KB_SYNC_QUEUE, KbEmbedJobData, KbSyncJobData } from '../../../queue/constants';

@ApiTags('chat/kb')
@Controller('chat/kb')
export class KBController {
  private readonly logger = new Logger(KBController.name);

  constructor(
    private readonly ingestDocument: IngestDocumentUseCase,
    @Inject(KB_REPOSITORY) private readonly kbRepository: IKBRepository,
    @Inject(VOICE_KB_SYNC) private readonly voiceKBSync: IVoiceKBSync,
    private readonly voiceAlertService: VoiceAlertService,
    private readonly prisma: PrismaService,
    @InjectQueue(KB_EMBED_QUEUE) private readonly embedQueue: Queue<KbEmbedJobData>,
    @InjectQueue(KB_SYNC_QUEUE)  private readonly syncQueue:  Queue<KbSyncJobData>,
  ) {}

  @Get('voice-usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'ElevenLabs character usage for current billing period' })
  async voiceUsage(): Promise<{ characterCount: number; characterLimit: number; remainingPct: number; resetAt: string | null }> {
    const usage = await this.voiceAlertService.fetchUsage();
    if (!usage) return { characterCount: 0, characterLimit: 0, remainingPct: 0, resetAt: null };
    const sub = usage as ElevenLabsSubscription;
    const remaining = sub.character_limit - sub.character_count;
    const remainingPct = sub.character_limit > 0 ? Math.round((remaining / sub.character_limit) * 100) : 0;
    const resetAt = sub.next_character_count_reset_unix
      ? new Date(sub.next_character_count_reset_unix * 1000).toISOString()
      : null;
    return { characterCount: sub.character_count, characterLimit: sub.character_limit, remainingPct, resetAt };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [KBDocumentResponseDto] })
  async findAll(): Promise<KBDocumentResponseDto[]> {
    const docs = await this.kbRepository.findAll();
    return docs.map(this.toResponseDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: KBDocumentResponseDto })
  async create(@Body() dto: CreateKBDocumentDto): Promise<KBDocumentResponseDto> {
    // IngestDocumentUseCase persists doc + enqueues kb-embed job (embed → kb-sync)
    const doc = await this.ingestDocument.execute({
      title: dto.title,
      content: dto.content,
      published: dto.published,
      metadata: dto.metadata,
    });
    return this.toResponseDto(doc);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: KBDocumentResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKBDocumentDto,
  ): Promise<KBDocumentResponseDto> {
    const existing = await this.kbRepository.findById(id);
    if (!existing) throw new NotFoundException(`KBDocument #${id} not found`);

    const updateData: { title?: string; content?: string; metadata?: Record<string, unknown>; published?: boolean } = {};
    if (dto.title     !== undefined) updateData.title     = dto.title;
    if (dto.published !== undefined) updateData.published = dto.published;
    if (dto.metadata  !== undefined) updateData.metadata  = dto.metadata as Record<string, unknown>;
    if (dto.content   !== undefined) updateData.content   = dto.content;

    const updated = await this.kbRepository.update(id, updateData);

    // Re-embed + re-sync whenever title or content changes
    if (dto.title !== undefined || dto.content !== undefined) {
      await this.embedQueue.add(
        'embed',
        { docId: id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
      );
    }

    return this.toResponseDto(updated);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Document deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    const existing = await this.kbRepository.findById(id);
    if (!existing) throw new NotFoundException(`KBDocument #${id} not found`);

    await this.kbRepository.delete(id);

    // Enqueue ElevenLabs delete with the ID in job data — no DB lookup needed in worker
    if (existing.elevenLabsDocId) {
      await this.syncQueue.add(
        'delete',
        { action: 'delete', elevenLabsDocId: existing.elevenLabsDocId },
        { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
      );
    }
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [KBAnalyticsItemDto] })
  async analytics(): Promise<KBAnalyticsItemDto[]> {
    const rows = await this.prisma.$queryRaw<
      { doc_id: string; title: string; citation_count: number }[]
    >(Prisma.sql`
      SELECT
        elem->>'id'    AS doc_id,
        elem->>'title' AS title,
        COUNT(*)::int  AS citation_count
      FROM chat_messages,
           jsonb_array_elements(sources::jsonb) AS elem
      WHERE jsonb_typeof(sources::jsonb) = 'array'
        AND elem->>'id' IS NOT NULL
      GROUP BY elem->>'id', elem->>'title'
      ORDER BY citation_count DESC
      LIMIT 30
    `);
    return rows.map((r) => ({
      docId: r.doc_id,
      title: r.title ?? '(deleted)',
      citationCount: r.citation_count,
    }));
  }

  @Post('sync-elevenlabs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Backfill result' })
  async syncElevenLabs(): Promise<{ synced: number; skipped: number; failed: number }> {
    const docs = await this.kbRepository.findAll();
    let synced = 0, skipped = 0, failed = 0;

    for (const doc of docs) {
      if (doc.elevenLabsDocId) { skipped++; continue; }
      try {
        const elevenLabsDocId = await this.voiceKBSync.createDoc(doc.title, doc.content);
        if (elevenLabsDocId) {
          await this.kbRepository.update(doc.id, { elevenLabsDocId });
          synced++;
        } else { failed++; }
      } catch { failed++; }
    }

    this.logger.log(`ElevenLabs KB backfill: ${synced} synced, ${skipped} already synced, ${failed} failed`);
    return { synced, skipped, failed };
  }

  private toResponseDto(doc: KBDocument): KBDocumentResponseDto {
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      published: doc.published,
    };
  }
}
