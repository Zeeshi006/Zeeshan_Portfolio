import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LLM_PROVIDER } from './domain/ports/llm-provider.port';
import { EMBEDDING_PROVIDER } from './domain/ports/embedding-provider.port';
import { KB_REPOSITORY } from './domain/ports/kb-repository.port';
import { VOICE_KB_SYNC } from './domain/ports/voice-kb-sync.port';
import { DeepSeekAdapter } from './infrastructure/adapters/deep-seek.adapter';
import { OpenAIEmbeddingAdapter } from './infrastructure/adapters/openai-embedding.adapter';
import { ElevenLabsKBAdapter } from './infrastructure/adapters/elevenlabs-kb.adapter';
import { PrismaKBRepository } from './infrastructure/repositories/prisma-kb.repository';
import { KbEmbedProcessor } from './infrastructure/processors/kb-embed.processor';
import { KbSyncProcessor } from './infrastructure/processors/kb-sync.processor';
import { AnswerQuestionUseCase } from './application/use-cases/answer-question.use-case';
import { IngestDocumentUseCase } from './application/use-cases/ingest-document.use-case';
import { SpendGuardService } from './application/services/spend-guard.service';
import { RateLimitService } from './application/services/rate-limit.service';
import { IntentFilterService } from './application/services/intent-filter.service';
import { AnswerCacheService } from './application/services/answer-cache.service';
import { EmbeddingCacheService } from './application/services/embedding-cache.service';
import { VoiceAlertService } from './application/services/voice-alert.service';
import { ChatController } from './presentation/controllers/chat.controller';
import { KBController } from './presentation/controllers/kb.controller';
import { ConversationsController } from './presentation/controllers/conversations.controller';
import { KB_EMBED_QUEUE, KB_SYNC_QUEUE } from '../queue/constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: KB_EMBED_QUEUE }),
    BullModule.registerQueue({ name: KB_SYNC_QUEUE }),
  ],
  controllers: [ChatController, KBController, ConversationsController],
  providers: [
    { provide: LLM_PROVIDER, useClass: DeepSeekAdapter },
    { provide: EMBEDDING_PROVIDER, useClass: OpenAIEmbeddingAdapter },
    { provide: KB_REPOSITORY, useClass: PrismaKBRepository },
    { provide: VOICE_KB_SYNC, useClass: ElevenLabsKBAdapter },
    KbEmbedProcessor,
    KbSyncProcessor,
    AnswerQuestionUseCase,
    IngestDocumentUseCase,
    SpendGuardService,
    RateLimitService,
    IntentFilterService,
    AnswerCacheService,
    EmbeddingCacheService,
    VoiceAlertService,
  ],
  exports: [KB_REPOSITORY, EmbeddingCacheService, VOICE_KB_SYNC, VoiceAlertService,
    BullModule.registerQueue({ name: KB_EMBED_QUEUE }),
  ],
})
export class ChatModule {}
