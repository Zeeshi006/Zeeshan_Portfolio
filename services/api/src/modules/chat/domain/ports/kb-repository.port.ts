import { KBDocument } from '../entities/kb-document.entity';

export const KB_REPOSITORY = Symbol('KB_REPOSITORY');

export interface IKBRepository {
  findAll(): Promise<KBDocument[]>;
  findById(id: string): Promise<KBDocument | null>;
  create(doc: Omit<KBDocument, 'id'> & { embedding?: number[] }): Promise<KBDocument>;
  update(id: string, doc: Partial<Omit<KBDocument, 'id'>> & { embedding?: number[]; elevenLabsDocId?: string | null }): Promise<KBDocument>;
  delete(id: string): Promise<void>;
  similaritySearch(embedding: number[], topK: number): Promise<KBDocument[]>;
}
