export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
