# Chatbot & Voice Agent — Full Review & Implementation Plan

> Reviewed against: security, cost, UX, admin control, architecture.
> Each item has a priority tag: **P0** (bug/critical) · **P1** (high) · **P2** (medium) · **P3** (polish)

---

## 🐛 Critical Bugs (P0 — fix before anything else)

### 1. Spend Guard Never Records Spend
**Problem:** `SpendGuardService.recordSpend()` is defined but **never called anywhere**. The daily spend key stays at 0 forever. The `isDailyLimitExceeded()` check will never fire. You have no real cost ceiling.

**Root cause:** `chat.controller.ts` calls `isDailyLimitExceeded()` but there is no call to `recordSpend(inputTokens, outputTokens, embeddingTokens)` after the LLM responds.

**Fix:** In `answer-question.use-case.ts`, after `chatWithTools()` returns, call `spendGuard.recordSpend()` with token counts from the LLM response. DeepSeek returns `usage.prompt_tokens` and `usage.completion_tokens` in the response.

**Files:**
- `services/api/src/modules/chat/infrastructure/adapters/deep-seek.adapter.ts` — expose token usage in return value
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts` — call `recordSpend`
- `services/api/src/modules/chat/application/services/spend-guard.service.ts` — already correct

---

### 2. Spend Guard Race Condition
**Problem:** `isDailyLimitExceeded()` (read) and `recordSpend()` (write) are separate Redis operations. Under concurrent load — two requests arrive simultaneously, both read spend=0.49, both see it's under $0.50, both proceed. You overshoot the ceiling.

**Fix:** Replace the two-step pattern with a Lua script that does atomic check-and-increment:
```lua
local current = tonumber(redis.call('GET', KEYS[1])) or 0
if current >= tonumber(ARGV[1]) then return 0 end  -- over ceiling
redis.call('INCRBYFLOAT', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], 172800)
return 1  -- allowed
```
Single `redis.eval()` call replaces both check + record. Returns 0 = blocked, 1 = allowed.

**Files:**
- `services/api/src/modules/chat/application/services/spend-guard.service.ts`

---

## 🔒 Security Hardening (P1)

### 3. Intent Filter Is Trivially Bypassable
**Problem:** The 13 regex patterns are too narrow. Bypasses include: "behave as", "pretend to be", "roleplay as", "you're now", "from now on you are", "DAN", "jailbreak", "ignore all rules". Also blocks legitimate queries — "translate my question" (about Hammad's multilingual work) gets blocked.

**Fix:** Replace with two-layer approach:
- **Layer 1:** Expanded regex list (add ~20 patterns covering the common bypass vocabulary)
- **Layer 2:** If KB similarity score for the top result is < 0.35 cosine similarity, the query has no grounding — respond with the off-topic message without hitting the LLM. This is cheaper (just embedding cost) and semantically correct.

**Files:**
- `services/api/src/modules/chat/application/services/intent-filter.service.ts`
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts` — add similarity threshold check

---

### 4. Conversation History Not Validated Server-Side
**Problem:** The client sends up to 15 history turns. A crafted client could send history with injected "assistant" messages claiming Hammad said things he didn't, poisoning the LLM context. There's also no total length check — 15 turns × 1000 chars = 15k characters of injected context.

**Fix:**
- Cap each history turn at 500 characters (trim silently)
- Cap total history at 5,000 characters total
- Strip any turns where `role` is not exactly `"user"` or `"assistant"`
- Validate via class-validator in `ConversationTurnDto`

**Files:**
- `services/api/src/modules/chat/presentation/dtos/chat.dto.ts`
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts`

---

### 5. Cache Bypass via sessionId
**Problem:** When any `sessionId` is present in the request, the answer cache is skipped entirely — forcing a fresh LLM call every time. The frontend always sends a sessionId. This means the cache effectively never hits in practice.

**Fix:** Cache should be keyed on `query` alone (normalized). Visitor context is additive — it personalises the opening line but the core answer is the same. Approach: check cache first; if hit, still inject visitor context as a prefix sentence via a lightweight prompt (`"Note: this visitor browsed Skills → Projects. Open with a relevant hook."`), then return the cached answer body.

**Files:**
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts`
- `services/api/src/modules/chat/application/services/answer-cache.service.ts`

---

### 6. No Per-Session Daily Budget Cap
**Problem:** A single persistent session (same cookie for 7 days) can exhaust the entire daily $0.50 budget alone by sending ~180 queries before the ceiling trips.

**Fix:** Add a per-session daily cap in `RateLimitService` or a new `SessionBudgetService`:
- Track `spend:session:{sessionId}:{date}` in Redis (float, INCRBYFLOAT)
- Default cap: 30 queries/session/day (configurable via `SESSION_DAILY_QUERY_LIMIT` env)
- Graceful message: "You've explored a lot today! Reach Hammad directly for more."

**Files:**
- `services/api/src/modules/chat/application/services/rate-limit.service.ts` — add daily query cap per session
- `services/api/src/modules/chat/presentation/controllers/chat.controller.ts`

---

### 7. IP Blocklist Has No Admin UI
**Problem:** The blocklist is a Redis `SET` key `"blocklist"`. Admins can't add/remove IPs without Redis CLI access.

**Fix:** Add admin endpoints and UI:
- `POST /chat/admin/blocklist` — add IP
- `DELETE /chat/admin/blocklist/:ip` — remove IP
- `GET /chat/admin/blocklist` — list all blocked IPs

**Files:**
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts` — add 3 endpoints
- `apps/web/src/app/(admin)/admin/dashboard/security/page.tsx` — add Blocklist section

---

### 8. ElevenLabs Webhook Has No Signature Verification
**Problem:** `POST /chat/transcript` is protected by `JwtAuthGuard`. But ElevenLabs webhooks can't send JWT tokens — they send HMAC signatures. Either the endpoint is inaccessible to ElevenLabs, or you'll need to change the guard.

**Fix:** Create a separate `POST /chat/voice-webhook` endpoint with:
- No JWT guard
- HMAC-SHA256 signature verification using `ELEVENLABS_WEBHOOK_SECRET`
- `rawBody` parsing (must happen before JSON parse, use `NestExpressApplication.useBodyParser` with `verify` callback)
- Rate limit: only accept from ElevenLabs IP ranges (optional)

**Files:**
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts`
- `services/api/src/main.ts` — raw body middleware

---

## 💰 Cost Optimisation (P1–P2)

### 9. Embedding Cache (P1)
**Problem:** Every query generates a fresh embedding — even if 50 users ask "what are your skills?" today. Each embedding call costs ~$0.00002 per query but more importantly adds 100–200ms latency.

**Fix:** Before calling `embeddingProvider.embed(query)`, check `embed:cache:{sha256(normalized_query)}` in Redis (48h TTL). On miss, embed and store. On hit, skip the OpenAI call.

**Estimated savings:** 40–60% of embedding API calls on common questions.

**Files:**
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts`
- New: `services/api/src/modules/chat/application/services/embedding-cache.service.ts`

---

### 10. Daily / Monthly Spend Dashboard in Admin (P1)
**Problem:** There's no visibility into what the chatbot is actually costing. Admin can see conversations but not dollars.

**Fix:** Add spend tracking to the analytics admin page:
- `GET /chat/admin/spend` — returns `{today, yesterday, last7days, thisMonth, allTime}` (all in USD)
- Store spend in Redis with keys: `spend:YYYY-MM-DD` (already exists), aggregate on read
- Admin conversations page gains a "Cost" tab showing:
  - Daily spend bar chart (last 14 days)
  - Today's spend + ceiling progress bar
  - Avg cost per query

**Files:**
- `services/api/src/modules/chat/application/services/spend-guard.service.ts` — add `getSpendSummary()`
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts` — add `/chat/admin/spend`
- `apps/web/src/app/(admin)/admin/dashboard/conversations/page.tsx` — add spend tab

---

### 11. Admin-Configurable Rate Limits & Budget (P2)
**Problem:** Rate limits (`RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_DAY`) and daily ceiling (`DAILY_SPEND_CEILING_USD`) are env vars — changing them requires a deploy.

**Fix:** Store overrides in `SiteContent` table (key: `"chatbot_config"`, value: JSON):
```json
{
  "dailyCeilingUsd": 0.50,
  "rateLimitPerMinute": 10,
  "rateLimitPerHour": 40,
  "rateLimitPerDay": 100,
  "maxResponseTokens": 300,
  "cacheEnabled": true,
  "voiceEnabled": true,
  "chatEnabled": true
}
```
Config services read from DB first, fall back to env. Admin UI shows sliders/toggles.

**Files:**
- `services/api/src/modules/chat/application/services/spend-guard.service.ts`
- `services/api/src/modules/chat/application/services/rate-limit.service.ts`
- New admin page: `apps/web/src/app/(admin)/admin/dashboard/chatbot-settings/page.tsx`

---

### 12. Model Fallback on High Spend (P2)
**Problem:** DeepSeek Chat (full) costs more than DeepSeek Flash. When daily spend > 75% of ceiling, automatically downgrade to the faster/cheaper Flash variant.

**Fix:** In `SpendGuardService`, add `getModelTier()`:
- spend < 75% ceiling → `deepseek/deepseek-chat` (default)
- spend ≥ 75% ceiling → `deepseek/deepseek-chat` with `max_tokens: 150` (shorter answers)
- spend ≥ 90% ceiling → return cached-only responses, no new LLM calls

**Files:**
- `services/api/src/modules/chat/application/services/spend-guard.service.ts`
- `services/api/src/modules/chat/infrastructure/adapters/deep-seek.adapter.ts`

---

## ✨ UX Improvements (P1–P2)

### 13. Server-Sent Events (SSE) Streaming (P1)
**Problem:** The frontend waits for the full 300-token response before showing anything. At DeepSeek speeds this is 1–3 seconds of blank waiting. The backend already has `stream()` on `ILLMProvider` — it's just not wired.

**Fix:**
- Add `GET /chat/stream?query=...` SSE endpoint (or `POST /chat/stream` with EventStream response)
- NestJS: use `@Sse()` decorator with `Observable<MessageEvent>` return type
- Frontend: replace `fetch` with `EventSource` or `fetch` with `ReadableStream`, show tokens as they arrive (append to message bubble)
- Fallback: if EventSource unsupported, keep current POST behavior

**Architecture:**
```
POST /chat/stream
  → SpendGuard check
  → RateLimit check
  → AnswerQuestion (streaming version)
  → yields token chunks as SSE events
  → final event: `{ sources, toolCalls, done: true }`
```

**Files:**
- `services/api/src/modules/chat/presentation/controllers/chat.controller.ts` — add `@Sse()` endpoint
- `apps/web/src/components/ChatWidget.tsx` — streaming fetch logic

---

### 14. Answer Feedback (Thumbs Up/Down) (P1)
**Problem:** No signal on answer quality. Can't improve KB documents without knowing which answers are bad.

**Fix:**
- Add `thumbsUp Boolean?` and `thumbsDown Boolean?` to `ChatMessage` schema
- `PATCH /chat/messages/:id/feedback` endpoint (no auth — anyone who got the message can rate it)
- Rate: 1 feedback per messageId per session (Redis `feedback:seen:{messageId}` with 7d TTL)
- Admin conversations page: show 👍 / 👎 counts per conversation, flag conversations with low-rated answers

**Files:**
- `services/api/prisma/schema.prisma` — add fields to `ChatMessage`
- New migration
- `services/api/src/modules/chat/presentation/controllers/chat.controller.ts` — PATCH endpoint
- `apps/web/src/components/ChatWidget.tsx` — thumbs buttons under AI messages

---

### 15. Follow-Up Question Suggestions (P2)
**Problem:** After an answer, users don't know what to ask next. Suggested prompts disappear once the conversation starts.

**Fix:** The LLM response includes a second tool call: `suggestFollowUps(questions: string[])` — returns 2–3 contextual follow-up questions. These render as tappable chips below the answer.

**Alternatively (cheaper):** Hardcode follow-up chip templates per answer type (project → "What was the hardest part?", skills → "How did you learn X?"), triggered by detecting navigateToSection tool calls.

**Files:**
- `services/api/src/modules/chat/application/use-cases/answer-question.use-case.ts`
- `apps/web/src/components/ChatWidget.tsx`

---

### 16. "Ask Hammad Directly" Escalation (P2)
**Problem:** When the bot says "I don't have that info", there's no immediate call to action. Users leave.

**Fix:** Detect the "I don't have that info" response string server-side. Add a special flag `escalate: true` to the response. Frontend shows a special card:
```
I don't have that info in my knowledge base.
[📧 Email Hammad] [💬 WhatsApp]
```
Both links fire an analytics event (`chatbot_escalation`).

**Files:**
- `services/api/src/modules/chat/presentation/controllers/chat.controller.ts` — add `escalate` flag to response
- `apps/web/src/components/ChatWidget.tsx` — escalation card component

---

### 17. Chat UI Polish (P3)
Small but impactful improvements:

| Issue | Fix | File |
|---|---|---|
| No timestamps on messages | Add `createdAt` to `ChatMessage` frontend model, show relative time ("2 min ago") | `ChatWidget.tsx` |
| No copy button on AI answers | Add clipboard icon on AI message hover | `ChatWidget.tsx` |
| No scroll-to-bottom button | Show sticky ↓ button when user scrolls up mid-conversation | `ChatWidget.tsx` |
| Typing "…" is not streaming feedback | Show animated 3-dot pulse while waiting for response | `ChatWidget.tsx` |
| No "clear conversation" button | Add "New Chat" button in header | `ChatWidget.tsx` |
| SpeedDial duplicates ChatWidget | Remove the chat panel from SpeedDial, keep only voice — or make SpeedDial the primary and remove the separate floating ChatWidget | `SpeedDial.tsx` |

---

## 🎙 ElevenLabs Voice Integration (Full) (P1)

### 18. Real Voice SDK Wiring

**Architecture:**
```
User clicks "Call" in SpeedDial
  ↓
Frontend: GET /api/voice-token  (Next.js API route)
  ↓
Next.js: POST https://api.elevenlabs.io/v1/convai/conversation/token
  using ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID
  returns { conversation_url: "wss://..." }
  ↓
Frontend: new Conversation({ url }) from @elevenlabs/client
  handles WebRTC, mic, TTS playback automatically
  ↓
Call ends → onEnd callback
  → POST /chat/transcript with conversationId + turns
  → admin sees it in Conversations page
```

**What to build:**

#### 18a. Backend: Signed URL Endpoint
```typescript
// apps/web/src/app/api/voice-token/route.ts
// Calls ElevenLabs API, returns signed conversation URL
// NEVER exposes ELEVENLABS_API_KEY to client
// Rate limit: 1 token per IP per 30 seconds (Redis)
// Checks chatbot_config.voiceEnabled from SiteContent
```

#### 18b. Frontend: SDK Wiring in SpeedDial
```typescript
import { Conversation } from '@elevenlabs/client';

// Replace demo timer with:
const { status, endSession } = await Conversation.startSession({
  agentId: undefined,    // not needed — URL already encodes agent
  overrides: {
    agent: {
      prompt: { prompt: `Visitor context: ${visitorContext}` }  // optional
    }
  },
  connectionUrl: token.conversation_url,
  onConnect: () => setCallState('active'),
  onDisconnect: () => { setCallState('ended'); postTranscript(); },
  onMessage: ({ message, source }) => { /* append to live transcript */ },
  onError: (msg) => { /* show error card */ },
});
```

#### 18c. Mic Permission UX
Before requesting mic access:
- Show an explanation modal: "This will use your microphone to talk to Hammad's AI assistant"
- Check `navigator.permissions.query({name:'microphone'})` first
- If denied: show fallback "Use text chat instead" link

#### 18d. Call Duration Limit
- Admin-configurable max call duration (default: 5 minutes)
- Show countdown timer in call UI when < 60 seconds remain
- Auto-end on duration exceeded

**New files:**
- `apps/web/src/app/api/voice-token/route.ts`
- `apps/web/src/app/api/voice-webhook/route.ts` (ElevenLabs transcript webhook)

**Modified files:**
- `apps/web/src/components/SpeedDial.tsx`
- `apps/web/src/components/ai/useAIState.ts`
- `apps/web/package.json` — add `@elevenlabs/client`

**Env vars needed:**
```env
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=agent_...
ELEVENLABS_WEBHOOK_SECRET=whsec_...  # for transcript webhook verification
```

---

## 🛠 Admin Panel Extensions (P1–P2)

### 19. Chatbot Settings Page (P1)
New page: `/admin/dashboard/chatbot-settings`

**Sections:**

#### Feature Toggles
- Chat enabled/disabled (toggle → stored in SiteContent)
- Voice enabled/disabled
- Answer caching enabled/disabled

#### Rate Limits
- Sliders: queries/minute (1–30), queries/hour (10–200), queries/day (20–500)
- "Reset all limits" button (clears Redis rate limit keys)

#### Spend Management
- Daily budget slider ($0.10–$5.00)
- Today's spend progress bar (live, polls every 30s)
- "Reset today's spend" button (emergency, clears Redis key)

#### Response Configuration
- Max response tokens slider (100–800)
- Cache TTL (15 min / 1 hour / 4 hours / 24 hours)
- Escalation email/WhatsApp URL (editable)

#### IP Blocklist
- Table of blocked IPs with "Remove" button
- Text input to add new IP
- Shows blocklist from Redis `SET blocklist`

**Files:**
- New: `apps/web/src/app/(admin)/admin/dashboard/chatbot-settings/page.tsx`
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts` — config GET/PUT endpoints

---

### 20. Knowledge Base Analytics (P1)
**Problem:** Admin can't see which KB documents are actually useful.

**Fix:** Track which KB doc IDs appear as sources in chat messages. Already stored in `ChatMessage.sources JSON`. Add analytics queries:
- Top 10 cited KB documents (by source count)
- Documents with 0 citations in last 30 days (candidates for updating)
- Avg similarity score per document (from pgvector search results — need to store score)

Admin KB page gains a "Cited N times" badge on each document.

**Files:**
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts` — add `/chat/kb-analytics`
- `apps/web/src/app/(admin)/admin/dashboard/knowledge-base/page.tsx` — add citation badge

---

### 21. "Test Chatbot" Panel in Admin (P1)
**Problem:** When you update a KB document, there's no way to test if it improved the answer without opening the public site.

**Fix:** Add a collapsible "Test Query" panel to the Knowledge Base admin page:
- Text input for test query
- Hits `POST /chat` with admin JWT (bypassing rate limits)
- Shows response + sources + which KB docs matched

The admin chat bypasses rate limits by checking for admin JWT (already have `JwtAuthGuard`).

**Files:**
- `apps/web/src/app/(admin)/admin/dashboard/knowledge-base/page.tsx`
- `services/api/src/modules/chat/presentation/controllers/chat.controller.ts` — add admin test endpoint that skips rate limiting

---

### 22. Conversation Export & Flagging (P2)

#### Export
- `GET /chat/conversations/export?format=csv&from=2025-01-01` — export all conversations as CSV
- Admin conversations page: "Export" button → downloads CSV

#### Flagging
- Admin can click "Flag" on a conversation → sets `flagged: true` on `ChatSession`
- Flagged conversations show warning icon, can filter to show only flagged
- Use case: catch jailbreak attempts, document what users are trying

**Schema change:** add `flagged Boolean @default(false)` to `ChatSession`

**Files:**
- `services/api/prisma/schema.prisma`
- `services/api/src/modules/chat/presentation/controllers/conversations.controller.ts`
- `apps/web/src/app/(admin)/admin/dashboard/conversations/page.tsx`

---

### 23. Voice Agent Settings Page (P2)
New page: `/admin/dashboard/voice-settings`

**Sections:**
- Enable/Disable voice widget (toggle)
- Agent ID display (masked, read-only — change via env)
- Max call duration (slider: 1–10 minutes)
- Voice call stats: total calls, avg duration, completion rate
- Today's voice conversations with quick preview

---

### 24. Live Chat Monitor (P3)
**Problem:** Admin has no idea if someone is chatting right now.

**Fix:** Use WebSocket (Socket.IO already in stack) to broadcast chat events to admin:
- Chat opened → admin sees IP + session hash in a "Live Now" sidebar
- New message sent → message preview appears live
- Chat closed → session disappears from live list

Admin conversations page gets a "● LIVE" tab showing real-time activity.

**Complexity:** Medium-high (requires Socket.IO rooms for admin, auth for WS connection)

---

## 🏗 Architecture Improvements (P2)

### 25. Structured Logging for Chat Queries
**Problem:** No way to debug why the bot gave a bad answer in production.

**Fix:** Log structured objects to console (NestJS `Logger`) for every chat request:
```json
{
  "sessionId": "abc123...",
  "query": "what frameworks do you know",
  "kbDocsFound": 3,
  "topSimilarity": 0.82,
  "cacheHit": false,
  "tokensIn": 450,
  "tokensOut": 120,
  "latencyMs": 1240,
  "toolCallsCount": 1
}
```
These logs can feed into a future observability dashboard.

---

### 26. Conversation History Summarisation (P2)
**Problem:** With 15 turns × ~200 tokens each = 3,000 context tokens just for history. Long conversations get expensive.

**Fix:** After turn 8, summarise the first N turns into a single compact summary turn:
```
[Summary of earlier conversation: Visitor asked about NestJS experience, 
RAG chatbot implementation, and WebAuthn integration. Hammad worked at TapTap for 2 years...]
```
Store summary in session Redis key with 7d TTL. Frontend sends `historySummary` field instead of full history after turn 8.

---

## Priority Matrix

| # | Feature | Priority | Effort | Impact |
|---|---|---|---|---|
| 1 | Fix recordSpend never called | **P0** | XS | Critical |
| 2 | Fix spend guard race condition | **P0** | S | Critical |
| 3 | Intent filter hardening | **P1** | S | High |
| 4 | History validation | **P1** | XS | High |
| 5 | Fix cache bypass via sessionId | **P1** | S | High |
| 6 | Per-session budget cap | **P1** | S | High |
| 9 | Embedding cache | **P1** | S | High |
| 10 | Spend dashboard in admin | **P1** | M | High |
| 13 | SSE streaming | **P1** | M | High |
| 14 | Answer feedback (👍👎) | **P1** | M | High |
| 18 | Full ElevenLabs wiring | **P1** | L | High |
| 19 | Chatbot settings page | **P1** | M | High |
| 20 | KB analytics | **P1** | S | Medium |
| 21 | Test chatbot panel | **P1** | S | Medium |
| 7 | IP blocklist admin UI | **P1** | S | Medium |
| 8 | Voice webhook signature | **P1** | S | Medium |
| 11 | Admin-configurable limits | **P2** | M | Medium |
| 12 | Model fallback on high spend | **P2** | S | Medium |
| 15 | Follow-up suggestions | **P2** | M | Medium |
| 16 | Escalation card | **P2** | S | Medium |
| 17 | Chat UI polish | **P3** | M | Low |
| 22 | Export & flagging | **P2** | M | Medium |
| 23 | Voice settings page | **P2** | M | Medium |
| 24 | Live chat monitor | **P3** | L | Low |
| 25 | Structured logging | **P2** | S | Medium |
| 26 | History summarisation | **P2** | M | Low |

---

## Suggested Implementation Order

### Sprint 1 — Fix the Bugs (half a day)
1, 2, 4, 5 — These are code changes to existing files, no new infrastructure.

### Sprint 2 — Security + Cost (1 day)
3, 6, 7, 8, 9 — Rate limiting improvements, embedding cache, blocklist UI, webhook security.

### Sprint 3 — Admin Power Tools (1–2 days)
10, 19, 20, 21 — Spend dashboard, chatbot settings page, KB analytics, test panel.

### Sprint 4 — UX (1 day)
13, 14, 16, 17 — SSE streaming (biggest UX win), feedback buttons, escalation, polish.

### Sprint 5 — Voice (1–2 days)
18, 23 — Full ElevenLabs SDK wiring, voice settings page.

### Sprint 6 — Advanced (optional)
11, 12, 15, 22, 24, 25, 26 — Admin config, model fallback, follow-ups, export, live monitor.

---

## Env Vars to Add

```env
# Spend
DAILY_SPEND_CEILING_USD=0.50          # already exists in code, just not wired
SESSION_DAILY_QUERY_LIMIT=30          # new

# ElevenLabs
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=agent_...
ELEVENLABS_WEBHOOK_SECRET=whsec_...

# Rate limits (already in code, confirm they're in .env)
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=40
RATE_LIMIT_PER_DAY=100
```
