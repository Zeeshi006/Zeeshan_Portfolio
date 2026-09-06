-- Add HNSW index for fast cosine-similarity nearest-neighbour search on KB embeddings.
-- m=16 (max neighbours per layer) and ef_construction=64 are the pgvector defaults —
-- good recall/speed balance for up to ~1M rows. Increase ef_construction for higher recall.
CREATE INDEX IF NOT EXISTS kb_documents_embedding_hnsw_idx
  ON "kb_documents"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
