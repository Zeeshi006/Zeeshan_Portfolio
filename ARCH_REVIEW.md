# Chatbot System — Architectural Review

> Senior architect analysis across all four layers: routing, retrieval, generation, and frontend.
> Findings are prioritized by impact. Each section ends with a concrete recommendation.

---

## Executive Summary

The chatbot works. Responses are correct, streaming is live, voice integration is wired. But the system has accumulated structural debt across every layer that will limit reliability, maintainability, and correctness as traffic grows. The most critical issues are a security gap in the transcript endpoint, a missing database index that makes every personalised response slow, and a dual-LLM architecture with regex reconciliation that cannot handle natural language reliably.

The architecture is not broken — it is one layer of cleanup away from being genuinely production-quality.

---

## Layer 1 — Intent Routing

### Current architecture

Every query fires two LLM calls in parallel: a navigation router (`chatWithTools`) and a RAG streamer (`stream`). A set of regex heuristics (`isShortNavQuery`, `isNavOnlyIntent`, `QUESTION_WORDS`, `EXPLICIT_NAV_VERB`) then decides which output wins. The streaming path and the non-streaming path have diverged — the non-streaming `execute()` uses `chatWithTools` for RAG, the streaming `streamExecute()` uses `stream()` for RAG. These are not equivalent and will produce different tool-call behavior.

### Root cause

`stream()` does not support tool calls. Because navigation chips had to come from somewhere, a separate nav LLM call was added. The reconciliation logic grew from there.

### The fix: `streamWithTools`

Add one method to the `ILLMProvider` port:

```typescript
streamWithTools(
  messages: Message[],
  systemPrompt: string,
  tools: Tool[],
): AsyncIterable<{ token?: string; toolCall?: ToolCall; done?: boolean }>
```

The DeepSeek/OpenRouter API already supports streaming tool call deltas (`delta.tool_calls`) alongside content tokens. The adapter parses both as the stream arrives. With this:

- The nav LLM call disappears entirely
- `getNavigation()`, `isShortNavQuery()`, `isNavOnlyIntent()`, `QUESTION_WORDS`, `EXPLICIT_NAV_VERB`, `ORDINAL_MAP`, `matchLocalNavIntent()` — all deleted
- Intent classification lives in the model, not in regex
- One API call per query instead of two
- The output shape is the signal: no text + tool call = auto-navigate; text + tool call = answer with chip

The local ordinal blog-post matching (`"show me the second blog"`) is the one piece worth keeping as a zero-latency pre-filter, since it is unambiguous and saves an LLM call for a common pattern.

---

## Layer 2 — Retrieval Quality

### Missing database index (high impact)

`AnalyticsEvent` has no index on `sessionId`. The `buildVisitorContext` function runs on every personalised chat request, querying `analytics_events WHERE sessionId = ? AND createdAt >= ? AND type IN (...)`. Without an index, this is a full table scan. As the event table grows to tens of thousands of rows, this becomes the dominant latency source — more expensive than the LLM call itself.

**Fix:** Add a compound index `(sessionId, createdAt)` on `AnalyticsEvent`.

```sql
CREATE INDEX idx_analytics_session_time ON analytics_events(session_id, created_at DESC);
```

Add a Prisma migration. Do not wait — this index does not exist today.

### Unpublished documents returned by pgvector (medium impact)

`similaritySearch` queries the vector store without filtering `published = true`. Unpublished documents are ranked and returned from Postgres, then discarded in the use case. Every similarity search returns irrelevant results that consume one of the top-K slots and are immediately thrown away.

**Fix:** Push the filter into the SQL query in `PrismaKBRepository.similaritySearch`:

```sql
WHERE published = true
ORDER BY embedding <=> $1 LIMIT $2
```

### pgvector index not defined in migrations (high impact)

The HNSW or IVFFlat index on the `embedding` column is not in any Prisma migration. Without it, every similarity search is a sequential scan of the full `kb_documents` table. The schema marks the column as `Unsupported("vector(1536)")`, which means Prisma cannot manage it. A manual migration must create the index.

**Fix:**

```sql
CREATE INDEX kb_embedding_hnsw ON kb_documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Add this to a dedicated migration file. Document it. Verify it exists on the VPS.

### KB document content not length-validated

`CreateKBDocumentDto.content` has no `@MaxLength`. The OpenAI embedding API silently truncates input beyond ~32k characters. A poorly formatted large document will be partially embedded — the tail of the document is unretrievable.

**Fix:** Add `@MaxLength(12000)` to the content field. Split large documents at the KB management level.

### Embedding only content, not title

The embed processor embeds `doc.content` only. A recruiter query like "Sales CRM project" matches on title keywords, but the embedding is pure content. The title should be prepended: `embed(doc.title + "\n\n" + doc.content)`.

### ElevenLabs KB sync race condition (high impact)

`addDocToAgent` reads the current agent KB list, appends a doc, and PATCHes the whole list back. With `concurrency: 2` on the sync processor, two workers can simultaneously read the same list, each append their doc, and both PATCH — the second PATCH overwrites the first. One document silently disappears from the ElevenLabs agent.

**Fix:** Reduce processor concurrency to 1 for the sync processor, or use an in-process mutex (a `Queue` that serialises the read-modify-write). The ElevenLabs API does not support atomic append.

Additionally: the delete-then-create upsert pattern leaves the ElevenLabs agent without that document between the two API calls. If `createDoc` fails after `deleteDoc` succeeds, the document is gone from the agent and the DB still holds the old `elevenLabsDocId`. On retry, the delete call gets a 404. Consider swapping the order: create first, update the DB with the new ID, then delete the old.

---

## Layer 3 — Generation Quality

### Hardcoded personal data in system prompt (medium impact)

The email address, employment status, core stack, and notable projects are hardcoded as string literals inside `answer-question.use-case.ts`. Changing any of these requires a server redeployment.

**Fix:** Move CORE FACTS to a `SiteContent` record with key `chat_core_facts`, fetched at startup (or cached in Redis with a short TTL). The admin can edit this without a deploy.

This is also where the `OFF_TOPIC_REPLY` constant and the email in `DAILY_LIMIT_MESSAGE` / `RATE_LIMIT_MESSAGE` should live.

### `max_tokens: 500` is too low for architectural questions

The DeepSeek adapter caps all responses at 500 tokens (~375 words). A detailed question about system design or a case study will be cut off mid-answer. The cap on the navigation router (`max_tokens: 300`) is reasonable — it should only emit a tool call, never prose.

**Fix:** Add `OPENROUTER_MAX_TOKENS` to the config with a sensible default of 800. Keep the nav router at 300.

### `chatWithTools` for voice summary should be `chat`

`generateVoiceSummary` calls `this.llm.chatWithTools(messages, prompt, [])` with an empty tools array. This routes through the tools-aware code path unnecessarily. Use `this.llm.chat(messages, prompt)` instead.

### Conversation history total size uncapped

`trimHistory` limits to 15 turns but each turn can be 4000 characters (`@MaxLength(4000)` on `VoiceTurnDto.message`). A 15-turn conversation could inject 60,000 characters of context into every request. The LLM context window and token costs are unbounded by turn count alone.

**Fix:** Add a total-character budget check in `trimHistory`: if the history exceeds a character limit (e.g. 8000 chars), drop the oldest turns until it fits.

### Spend tracking estimates are wrong for streaming

The streaming path estimates input tokens as `Math.ceil(systemPrompt.length / 4)`. System prompts with KB context blocks average closer to 3.5 characters per token. The spend dashboard systematically under-reports costs.

**Fix:** Switch to exact token counts by requesting `stream_options: { include_usage: true }` in the OpenRouter streaming call. The API returns a final `usage` chunk at the end of the stream.

---

## Layer 4 — Frontend / UX

### `window.open` vs `router.push` inconsistency

Auto-navigation (`navigationOnly: true`) uses `router.push` (same tab). Chips for `openProject` and `openBlogPost` use `window.open` (new tab). This creates different behavior for the same conceptual action depending on whether the user asked a question or gave a command.

**Decision needed:** Pick one. For a portfolio where the chat panel should stay open, `window.open` for content pages is the right call. If you go that route, also update the auto-navigate path for project/blog to open a new tab rather than leaving the current page.

### Stale `isMuted` closure in `mute_self` tool

The `mute_self` client tool closes over `isMuted` at the time `handleCallStart` runs. If the user manually toggles mute via the UI button after the call starts, `isMuted` inside the tool closure is stale. The tool will toggle to the wrong state.

**Fix:** Use `isMutedRef.current` (a ref kept in sync with the state) inside the tool handler.

### `liveTranscript` grows without bound

`setLiveTranscript(prev => [...prev, newTurn])` appends every turn during a voice call. For a long call with many turns, this causes increasingly expensive re-renders. There is no cap.

**Fix:** Cap at the last 50 turns: `setLiveTranscript(prev => [...prev, newTurn].slice(-50))`.

### `PROFANITY_LIST` belongs on the backend

The profanity filter is a hardcoded export in the frontend component. Updating it requires a frontend redeploy. It is trivially bypassed with Unicode substitution. The backend `IntentFilterService` already has a profanity check — the frontend one is redundant.

**Fix:** Remove the frontend profanity check. Trust the backend filter. If client-side feedback is needed (show error before sending), make it a simple character-count or length check only.

### `postTranscript` timing race

`onDisconnect` fires `postTranscript` immediately. The ElevenLabs SDK may still be delivering the last `onMessage` event when `onDisconnect` fires, meaning the last utterance is missing from the stored transcript.

**Fix:** Debounce `postTranscript` by 500ms after `onDisconnect`. Or rely on the ElevenLabs server-side transcript API rather than reconstructing it client-side.

---

## Cross-Cutting: Security

### Critical — JWT secret defaults to `undefined`

`app.config.ts` returns `process.env["JWT_SECRET"]` with no fallback and no startup validation. If the env var is missing, the JWT guard may accept any token or throw on every authenticated request. This is a critical gap for any environment other than local.

**Fix:** Add a NestJS config validation schema (Joi) that marks `JWT_SECRET` as required with a minimum length of 32 characters. The application should refuse to start if this is missing.

### High — `POST /chat/transcript` is unauthenticated

Any caller can POST arbitrary conversation data with any `conversationId`. The handler upserts a `ChatSession`, creates `ChatMessage` records, and fires a `generateVoiceSummary` call — consuming LLM tokens. A script looping on this endpoint could drain the daily spend budget in seconds.

**Fix:** Require a signed token in the request. The simplest approach: generate an HMAC of the `conversationId` using a `TRANSCRIPT_SECRET` env var on the server, include it in the browser after call end, and verify it on the endpoint. This requires no auth session — just a shared secret.

### ~~High — `GET /chat/kb/search` is unauthenticated~~ ✅ RESOLVED

The `Terminal.tsx` component (its only caller) has been removed. The endpoint itself has been deleted from `kb.controller.ts`. The `IEmbeddingProvider` injection it required has also been cleaned from the controller constructor. No action needed.

### Medium — `POST /chat/feedback` accepts arbitrary sessionIds

A caller who knows or guesses another visitor's session ID can submit feedback attributed to their session. The `sessionId` from `dto.sessionId` is stored directly in `AnalyticsEvent.sessionId`.

**Fix:** Ignore `dto.sessionId` entirely in the feedback endpoint. Derive the session ID from the cookie only.

### Medium — CORS defaults to localhost in production

`allowedOrigins` defaults to `["http://localhost:3000"]` if `ALLOWED_ORIGINS` is not set. A misconfigured production deploy silently blocks all frontend requests.

**Fix:** Make `ALLOWED_ORIGINS` required in the config validation schema. There is no sane default for a production server.

---

## Cross-Cutting: Observability

### All critical async operations swallow errors silently

`persistConversation`, `logQueryEvent`, `generateVoiceSummary`, `answerCache.set`, `spendGuard.recordSpend`, `embeddingCache.set` all end with `.catch(() => {})`. When Redis or Postgres is degraded, the system continues serving responses while silently failing every persistence operation. The admin dashboard shows nothing wrong.

**Fix:** Replace silent catches with structured logging. At minimum: `Logger.warn('[chat] persist failed', e.message)`. Consider a dead-letter queue for failed persistence operations that can be replayed.

### Spend dashboard shows $0 when Redis is down

`getDailySpend()` reads from Redis. If Redis is unavailable, it returns 0. `isDailyLimitExceeded()` then returns false, disabling the spend ceiling entirely. LLM calls continue uncapped with no indication anything is wrong.

**Fix:** If the Redis call fails, default to `isDailyLimitExceeded() = true` (fail closed, not open). Serve the graceful limit message rather than consuming unbounded tokens against a downed cache.

### No startup configuration validation

Missing env vars are discovered at runtime on the first failing API call, not at startup. `OPENROUTER_API_KEY` is not in `.env.example`. A developer following the setup docs would clone the repo, follow `.env.example`, start the server, and get a 401 on the first chat message with no explanation.

**Fix:** Add a Joi validation schema to `ConfigModule`. Required vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`. The server should refuse to start with a clear error message if any are missing.

---

## Performance

### `topQueries` loads 5,000 rows into memory

The admin top-queries endpoint fetches up to 5,000 `AnalyticsEvent` rows and groups them in JavaScript. This should be a single SQL aggregate query.

**Fix:**

```sql
SELECT metadata->>'query' AS query, COUNT(*) AS count
FROM analytics_events
WHERE type = 'chatbot_query'
GROUP BY metadata->>'query'
ORDER BY count DESC
LIMIT 20;
```

One query, no memory pressure, correct results.

### `findAll()` on KBRepository has no pagination

`kbRepository.findAll()` loads every KB document. Used by `syncElevenLabs`. At 100+ documents this is a memory and DB concern.

**Fix:** Add `findAll(options?: { skip?: number; take?: number })` and paginate the ElevenLabs sync in batches of 20.

### `redis.keys()` in cache invalidation

`answerCache.invalidateAll()` uses `KEYS chat:cache:*` — a blocking scan of the entire Redis keyspace. Use `SCAN` with a cursor instead.

---

## Prioritized Action Plan

| Priority | Item | Impact |
|---|---|---|
| 1 | Add `sessionId` index on `AnalyticsEvent` | Every personalised request is a table scan today |
| 2 | Add pgvector HNSW index to migrations | Every KB search is a full scan without it |
| 3 | Fix JWT secret — add config validation schema | Silent critical security gap |
| 4 | Auth-gate `POST /chat/transcript` with HMAC proof | Token drain attack surface (`GET /chat/kb/search` deleted ✅) |
| 5 | Filter `published = true` in pgvector query | Wasted DB work on every RAG request |
| 6 | Implement `streamWithTools` and remove dual-LLM + regex routing | Architectural correctness, no more heuristic patches |
| 7 | Fix ElevenLabs sync race (concurrency = 1 on processor) | Silent data loss on KB updates |
| 8 | Add structured logging to all fire-and-forget paths | Currently flying blind on failures |
| 9 | Move CORE FACTS to `SiteContent` table | Requires deploy to update personal info |
| 10 | Fix `topQueries` — move GROUP BY to SQL | Memory pressure as traffic grows |
| 11 | Fail closed on Redis down in spend guard | Spend ceiling silently disabled on Redis failure |
| 12 | Add `(title + content)` concatenation to embed processor | Better retrieval on title-keyword queries |
| 13 | Fix `isMuted` stale closure in voice call | Wrong mute state when user toggles manually |
| 14 | Cap `liveTranscript` array at 50 turns | Unbounded re-render growth in long calls |
| 15 | Remove frontend profanity filter | Redundant, unupdatable, trivially bypassed |

Items 1–5 should be done before any new features. Items 6–8 are the architectural cleanup round. Items 9–15 are polish.
