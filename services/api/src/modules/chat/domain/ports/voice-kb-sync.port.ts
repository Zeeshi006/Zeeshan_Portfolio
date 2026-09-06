export const VOICE_KB_SYNC = Symbol('VOICE_KB_SYNC');

export interface IVoiceKBSync {
  createDoc(title: string, content: string): Promise<string | null>;
  deleteDoc(elevenLabsDocId: string): Promise<void>;
}
