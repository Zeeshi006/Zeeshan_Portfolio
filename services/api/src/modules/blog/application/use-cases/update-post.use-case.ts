import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BLOG_REPOSITORY, IBlogRepository } from '../../domain/ports/blog-repository.port';
import { IKBRepository, KB_REPOSITORY } from '../../../chat/domain/ports/kb-repository.port';
import { IVoiceKBSync, VOICE_KB_SYNC } from '../../../chat/domain/ports/voice-kb-sync.port';
import { BlogPost } from '../../domain/entities/blog-post.entity';
import { ReadingTimeService } from '../services/reading-time.service';
import { KB_EMBED_QUEUE, KB_SYNC_QUEUE, KbEmbedJobData, KbSyncJobData } from '../../../queue/constants';

export interface UpdatePostInput {
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  canonicalUrl?: string;
  published?: boolean;
}

@Injectable()
export class UpdatePostUseCase {
  private readonly logger = new Logger(UpdatePostUseCase.name);

  constructor(
    @Inject(BLOG_REPOSITORY) private readonly repo: IBlogRepository,
    @Inject(KB_REPOSITORY)   private readonly kbRepo: IKBRepository,
    @Inject(VOICE_KB_SYNC)   private readonly voiceKBSync: IVoiceKBSync,
    @InjectQueue(KB_EMBED_QUEUE) private readonly embedQueue: Queue<KbEmbedJobData>,
    @InjectQueue(KB_SYNC_QUEUE)  private readonly syncQueue:  Queue<KbSyncJobData>,
    private readonly readingTime: ReadingTimeService,
  ) {}

  async execute(slug: string, input: UpdatePostInput): Promise<BlogPost> {
    const existing = await this.repo.findBySlug(slug);
    if (!existing) throw new NotFoundException('Post not found');

    const contentChanged  = input.content  !== undefined && input.content  !== existing.content;
    const publishingNow   = input.published === true  && !existing.published;
    const unpublishingNow = input.published === false && existing.published;

    const updates: Parameters<IBlogRepository['update']>[1] = {
      ...(input.title      !== undefined && { title: input.title }),
      ...(input.excerpt    !== undefined && { excerpt: input.excerpt }),
      ...(input.content    !== undefined && {
        content: input.content,
        readingTime: this.readingTime.compute(input.content),
      }),
      ...(input.tags       !== undefined && { tags: input.tags }),
      ...(input.canonicalUrl !== undefined && { canonicalUrl: input.canonicalUrl }),
      ...(input.published  !== undefined && { published: input.published }),
      ...(publishingNow    && { publishedAt: new Date() }),
      ...(unpublishingNow  && { publishedAt: null }),
    };

    const shouldEmbed  = publishingNow || (contentChanged && existing.published);
    const shouldRemove = unpublishingNow && existing.kbDocumentId;

    if (shouldEmbed) {
      const kbTitle   = `Blog: ${input.title ?? existing.title}`;
      const kbContent = `# ${input.title ?? existing.title}\n\nSlug: ${slug}\n\n${input.excerpt ?? existing.excerpt}\n\n${input.content ?? existing.content}`;

      if (existing.kbDocumentId) {
        // Update content in DB — queue will re-embed + re-sync ElevenLabs
        await this.kbRepo.update(existing.kbDocumentId, {
          title: kbTitle,
          content: kbContent,
          published: true,
        });
        updates.kbDocumentId = existing.kbDocumentId;
        await this.embedQueue.add(
          'embed',
          { docId: existing.kbDocumentId },
          { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
        );
      } else {
        // First publish — create KB doc, queue embedding
        const kbDoc = await this.kbRepo.create({
          title: kbTitle,
          content: kbContent,
          published: true,
          metadata: { source: 'blog', slug },
        });
        updates.kbDocumentId = kbDoc.id;
        await this.embedQueue.add(
          'embed',
          { docId: kbDoc.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
        );
      }
    }

    if (shouldRemove) {
      const kbDoc = await this.kbRepo.findById(existing.kbDocumentId!).catch(() => null);
      await this.kbRepo.delete(existing.kbDocumentId!).catch(() => {});
      updates.kbDocumentId = null;
      if (kbDoc?.elevenLabsDocId) {
        await this.syncQueue.add(
          'delete',
          { action: 'delete', elevenLabsDocId: kbDoc.elevenLabsDocId },
          { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
        );
      }
    }

    return this.repo.update(slug, updates);
  }
}
