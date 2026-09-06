import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IKBRepository, KB_REPOSITORY } from '../../domain/ports/kb-repository.port';
import { KBDocument } from '../../domain/entities/kb-document.entity';
import { KB_EMBED_QUEUE, KbEmbedJobData } from '../../../queue/constants';

export interface IngestDocumentInput {
  title: string;
  content: string;
  published?: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class IngestDocumentUseCase {
  constructor(
    @Inject(KB_REPOSITORY) private readonly kbRepository: IKBRepository,
    @InjectQueue(KB_EMBED_QUEUE) private readonly embedQueue: Queue<KbEmbedJobData>,
  ) {}

  async execute(input: IngestDocumentInput): Promise<KBDocument> {
    // Persist immediately — embedding + ElevenLabs sync happen async via queue
    const doc = await this.kbRepository.create({
      title: input.title,
      content: input.content,
      metadata: input.metadata ?? {},
      published: input.published ?? true,
    });

    // Enqueue embedding job — processor embeds → updates DB → enqueues ElevenLabs sync
    await this.embedQueue.add(
      'embed',
      { docId: doc.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );

    return doc;
  }
}
