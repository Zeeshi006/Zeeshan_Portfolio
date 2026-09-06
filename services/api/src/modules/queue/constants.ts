export const KB_EMBED_QUEUE = 'kb-embed';
export const KB_SYNC_QUEUE  = 'kb-sync';

export interface KbEmbedJobData {
  docId: string;
}

export interface KbSyncJobData {
  action: 'upsert' | 'delete';
  /** For upsert — processor fetches doc from DB */
  docId?: string;
  /** For delete — passed directly so processor doesn't need DB lookup after deletion */
  elevenLabsDocId?: string;
}
