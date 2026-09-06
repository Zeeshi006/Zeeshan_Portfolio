-- Compound index on analytics_events(sessionId, createdAt DESC)
-- buildVisitorContext queries this table by sessionId + createdAt range on every
-- personalised chat request. Without this index each query is a full table scan.
CREATE INDEX IF NOT EXISTS "analytics_events_sessionId_createdAt_idx"
  ON "analytics_events" ("sessionId", "createdAt" DESC);
