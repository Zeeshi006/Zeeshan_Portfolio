import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IKBRepository, KB_REPOSITORY } from '../../domain/ports/kb-repository.port';
import { IVoiceKBSync, VOICE_KB_SYNC } from '../../domain/ports/voice-kb-sync.port';
import { KB_SYNC_QUEUE, KbSyncJobData } from '../../../queue/constants';

@Processor(KB_SYNC_QUEUE, { concurrency: 2 })
export class KbSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(KbSyncProcessor.name);

  constructor(
    @Inject(KB_REPOSITORY) private readonly kbRepo: IKBRepository,
    @Inject(VOICE_KB_SYNC) private readonly voiceKBSync: IVoiceKBSync,
  ) {
    super();
  }

  async process(job: Job<KbSyncJobData>): Promise<void> {
    const { action } = job.data;

    if (action === 'delete') {
      if (job.data.elevenLabsDocId) {
        this.logger.log(`[kb-sync] Deleting ElevenLabs doc ${job.data.elevenLabsDocId}`);
        await this.voiceKBSync.deleteDoc(job.data.elevenLabsDocId);
      }
      return;
    }

    // upsert
    const doc = await this.kbRepo.findById(job.data.docId!);
    if (!doc) {
      this.logger.warn(`[kb-sync] Doc ${job.data.docId} not found — skipping upsert`);
      return;
    }

    // If doc already has an ElevenLabs ID, delete the old one first (content changed)
    if (doc.elevenLabsDocId) {
      this.logger.log(`[kb-sync] Replacing ElevenLabs doc ${doc.elevenLabsDocId}`);
      await this.voiceKBSync.deleteDoc(doc.elevenLabsDocId);
    }

    const newId = await this.voiceKBSync.createDoc(doc.title, doc.content);
    if (newId) {
      await this.kbRepo.update(doc.id, { elevenLabsDocId: newId });
      this.logger.log(`[kb-sync] ElevenLabs doc created: ${newId} for KB doc ${doc.id}`);
    }
  }
}
