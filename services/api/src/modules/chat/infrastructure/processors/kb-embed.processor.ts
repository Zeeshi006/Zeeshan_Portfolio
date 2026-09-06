import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IEmbeddingProvider, EMBEDDING_PROVIDER } from '../../domain/ports/embedding-provider.port';
import { IKBRepository, KB_REPOSITORY } from '../../domain/ports/kb-repository.port';
import { KB_EMBED_QUEUE, KB_SYNC_QUEUE, KbEmbedJobData, KbSyncJobData } from '../../../queue/constants';

@Processor(KB_EMBED_QUEUE, { concurrency: 3 })
export class KbEmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(KbEmbedProcessor.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(KB_REPOSITORY) private readonly kbRepo: IKBRepository,
    @InjectQueue(KB_SYNC_QUEUE) private readonly syncQueue: Queue<KbSyncJobData>,
  ) {
    super();
  }

  async process(job: Job<KbEmbedJobData>): Promise<void> {
    const { docId } = job.data;
    this.logger.log(`[kb-embed] Processing doc ${docId} (attempt ${job.attemptsMade + 1})`);

    const doc = await this.kbRepo.findById(docId);
    if (!doc) {
      this.logger.warn(`[kb-embed] Doc ${docId} not found — skipping`);
      return;
    }

    const embedding = await this.embeddingProvider.embed(doc.content);
    await this.kbRepo.update(docId, { embedding });

    this.logger.log(`[kb-embed] Embedding stored for doc ${docId} — queuing ElevenLabs sync`);

    await this.syncQueue.add(
      'upsert',
      { action: 'upsert', docId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );
  }
}
