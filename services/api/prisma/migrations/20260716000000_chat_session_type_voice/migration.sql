ALTER TABLE "chat_sessions" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "chat_sessions" ADD COLUMN "voiceConversationId" TEXT;
CREATE INDEX "chat_sessions_type_idx" ON "chat_sessions"("type");
