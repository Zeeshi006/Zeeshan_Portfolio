import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BLOG_REPOSITORY, IBlogRepository } from '../../domain/ports/blog-repository.port';
import { IKBRepository, KB_REPOSITORY } from '../../../chat/domain/ports/kb-repository.port';
import { IVoiceKBSync, VOICE_KB_SYNC } from '../../../chat/domain/ports/voice-kb-sync.port';

@Injectable()
export class DeletePostUseCase {
  private readonly logger = new Logger(DeletePostUseCase.name);

  constructor(
    @Inject(BLOG_REPOSITORY) private readonly repo: IBlogRepository,
    @Inject(KB_REPOSITORY) private readonly kbRepo: IKBRepository,
    @Inject(VOICE_KB_SYNC) private readonly voiceKBSync: IVoiceKBSync,
  ) {}

  async execute(slug: string): Promise<void> {
    const post = await this.repo.findBySlug(slug);
    if (!post) throw new NotFoundException('Post not found');

    if (post.kbDocumentId) {
      const kbDoc = await this.kbRepo.findById(post.kbDocumentId).catch(() => null);
      await this.kbRepo.delete(post.kbDocumentId).catch(() => {});
      if (kbDoc?.elevenLabsDocId) {
        void this.voiceKBSync.deleteDoc(kbDoc.elevenLabsDocId)
          .catch((err) => this.logger.error('ElevenLabs blog KB delete sync failed', err));
      }
    }

    await this.repo.delete(slug);
  }
}
