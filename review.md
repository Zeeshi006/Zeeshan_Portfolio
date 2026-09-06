# Codebase Review — Hammad Afzal Portfolio Platform

**Reviewer:** Senior Software Architect  
**Date:** 2026-06-10  
**Branch:** `hero/living-system`  
**Scope:** Full codebase — security, architecture, and UI/UX

---

## Part I — Security Review

### Summary

The security posture is solid for a personal portfolio: modern WebAuthn auth, Redis-backed rate limiting, intent filtering, spend ceilings, and IP blocklisting. Several gaps identified in the initial pass have since been resolved; remaining open items are documented below with fixes.

---

### Critical

#### SEC-01 — Voice Transcript Endpoint Has No Authentication — **OPEN**

`POST /chat/transcript` accepts arbitrary voice conversation data with zero authentication. There is no `JwtAuthGuard`, no session validation, and no signature verification from ElevenLabs.

**Impact:** Anyone can POST a fake transcript with any `conversationId` and overwrite or delete the stored transcript for that session. The atomic write fix (ARCH-04) has been applied, so data loss on crash is no longer possible, but unauthenticated writes remain a concern.

**Fix:**
- Add an HMAC signature header that ElevenLabs signs on delivery and verify it server-side.
- If ElevenLabs doesn't support signing, generate a short-lived token at voice-session start and pass it through conversation metadata, verifying it on ingest.

---

#### SEC-02 — Next.js Middleware Checks Cookie Presence, Not Validity — ✅ Fixed

~~`middleware.ts` checked `request.cookies.get("admin_token")?.value` — a truthy string — without verifying the JWT signature or expiry.~~

**Resolution:** Middleware now imports `jwtVerify` from `jose` and verifies the token's signature and expiry on every protected route. Invalid or expired tokens are rejected and the stale cookie is cleared before redirecting to `/admin/login`.

---

### High

#### SEC-03 — Adminer Exposed in Development Compose — **OPEN**

`docker-compose.yml` exposes Adminer on `0.0.0.0:8080` with default credentials `portfolio/portfolio`. If a developer runs this on a machine with a public IP or shared network, the entire database is exposed.

**Fix:** Bind to localhost: `ports: ["127.0.0.1:8080:8080"]`, or remove Adminer and use `psql` / DataGrip.

---

#### SEC-04 — Passkey Registration Is Unauthenticated — **OPEN**

`PasskeyService.beginRegistration()` has no guard. Any caller can initiate registration. The single shared Redis key `passkey:challenge:register` also creates a race condition: a concurrent second call overwrites the first challenge, silently failing the first registration attempt.

**Fix:** Add `@UseGuards(JwtAuthGuard)` to `beginRegistration`. Scope challenge keys by nonce: `passkey:challenge:register:{nonce}` so concurrent registrations don't collide.

---

#### SEC-05 — `admin-auth` Set Action Has No CSRF Origin Check — **OPEN**

`/api/admin-auth` (POST `{ action: "set", token: "..." }`) sets the httpOnly `admin_token` cookie. While the cookie uses `sameSite: 'strict'`, the route itself accepts cross-origin requests. A CSRF attack could set an attacker-controlled token value.

**Fix:** Verify the `Origin` or `Referer` header matches the allowed origin before setting the cookie.

---

### Medium

#### SEC-06 — Streaming Path Bypasses Spend Guard — ✅ Fixed

~~`streamExecute()` never called `spendGuard.recordSpend()`. Since the frontend prefers SSE, the $0.50/day ceiling was largely unenforced.~~

**Resolution:** `streamExecute()` now accumulates the full response text, then fire-and-forgets `recordSpend()` after the stream loop completes. The daily ceiling now covers both streaming and non-streaming traffic.

---

#### SEC-07 — Intent Filter Over-Blocks Legitimate Queries — ✅ Fixed

~~Broad patterns like `/write.*code/i` and `/\bsudo\b/i` were blocking legitimate portfolio questions. The 500-char limit was too tight for case-study questions.~~

**Resolution:**
- `/write.*code/i` replaced with `/write\s+(me\s+|some\s+|a\s+)?code\b/i` — only blocks explicit "write me code" requests.
- `/what is .*(capital|weather|recipe)/i` replaced with a tighter pattern that matches actual general-knowledge queries, not professional questions containing those words.
- `/\bsudo\b/i` retained (blocks override markers) but no longer creates false positives for words like "pseudo" since the pattern requires a word boundary.
- Query length limit raised from 500 → 1000 characters.

---

#### SEC-08 — Error Details Leaked in Voice Token Route — ✅ Fixed

~~`voice-token/route.ts` returned raw ElevenLabs error text and `String(err)` from caught exceptions directly to the client.~~

**Resolution:** Raw error detail is now logged server-side via `console.error`. The client always receives the generic message `"Voice agent temporarily unavailable."` regardless of the underlying failure.

---

#### SEC-09 — Session ID Is Caller-Controlled via Header — ✅ Fixed

~~`ChatController.resolveSessionId()` accepted `x-session-id` from the request header as a fallback, allowing a caller to supply any string and pollute rate-limit tracking.~~

**Resolution:** `resolveSessionId()` now reads only the httpOnly `chat_session` cookie. The `@Headers('x-session-id')` parameter has been removed from both `ask` and `stream` endpoints entirely.

---

#### SEC-10 — Redis Has No Password in Production Compose — **OPEN**

`docker-compose.prod.yml` connects to Redis with `redis://redis:6379` — no AUTH password. Redis is on the `internal` Docker network (correct mitigation), but defense-in-depth warrants a password.

**Fix:**
```yaml
redis:
  command: redis-server --requirepass ${REDIS_PASSWORD} --save 60 1
```
Update `REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379` in the api service.

---

### Low

#### SEC-11 — IP Hash Truncation + Namespace Mixing — **OPEN**

`sha256(rawIp).digest('hex').slice(0, 16)` yields 64 bits. For voice transcripts the hash input is `'voice:' + dto.conversationId` where `conversationId` is attacker-supplied — mixing attacker-controlled input into the same hash namespace as real IP hashes is unnecessary.

**Fix:** Use the full hash (or a dedicated prefix) for voice session IDs so the namespaces don't overlap.

---

#### SEC-12 — `process.env` Inline in Cookie Setter — **OPEN**

`chat.controller.ts` uses `process.env['NODE_ENV']` directly in `setSessionCookie()`, violating the CLAUDE.md rule of using `ConfigService`.

---

#### SEC-13 — Dev Compose JWT Weak Fallback — **OPEN**

`JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-prod}` — if a developer forgets to set `JWT_SECRET`, tokens are signed with a publicly known default. Remove the fallback and fail fast on startup instead.

---

## Part II — Architecture Review

### Summary

This is a genuinely well-architected codebase. The NestJS clean architecture layering is properly enforced, the port-and-adapter pattern for the LLM provider is textbook, and the technology choices (pgvector, sliding-window Redis rate limiting, SSE streaming, Turborepo monorepo) are all defensible and sophisticated. Several gaps identified in the initial pass have been resolved.

---

### Strengths

**Clean Architecture is actually clean.** Domain → application → infrastructure → presentation is enforced. No Prisma calls leak into use-cases, no business logic exists in controllers. The `LLMProvider` port with `DeepSeekAdapter` in infrastructure is exactly right — swapping models requires touching one file.

**pgvector in-process.** Using the existing Postgres instance for vector embeddings avoids a separate Pinecone/Qdrant service. Correct choice for this scale.

**Spend Guard design.** `INCRBYFLOAT` on a per-day Redis key with a 48h TTL is atomic, lightweight, and correct. The fire-and-forget pattern keeps the hot path fast.

**Sliding-window rate limiter.** The sorted-set implementation (`zremrangebyscore` + `zadd` + `zcard`) is the standard approach. IPv6 /64 normalization prevents trivial bypass.

**Visitor context personalisation.** Reading the last 30 minutes of analytics events and injecting browsing signals into the system prompt is architecturally elegant — analytics infrastructure does double duty as personalisation input.

**Answer cache with personalisation bypass.** Skipping the cache when visitor context exists is correct. The cache key is normalized (lowercase + trim + collapse whitespace) in `AnswerCacheService.buildKey()` so case variants of the same query hit the same entry.

**Production Docker Compose.** Adminer removed, all services on `internal` network, Caddy for TLS, no exposed DB ports.

---

### Concerns

#### ARCH-01 — Streaming Path Doesn't Track Spend or Use Cache — ✅ Fixed

~~`streamExecute()` bypassed both `spendGuard.recordSpend()` and `answerCache`. The spend ceiling was therefore based on a minority of requests.~~

**Resolution:** `streamExecute()` now checks the cache before making an LLM call (returning instantly on hit), accumulates the full response during streaming, and fire-and-forgets `recordSpend()` and `answerCache.set()` after the loop. Both spend tracking and caching now cover the streaming path.

---

#### ARCH-02 — Double `buildVisitorContext` DB Query in Streaming Path — ✅ Fixed

~~When `streamExecute()` needed to pre-check the cache (requiring `visitorCtx`), it would have called `buildVisitorContext()` once for the check and again inside `buildQueryContext()` — two identical Prisma queries per request.~~

**Resolution:** `buildQueryContext()` now accepts an optional `precomputedVisitorCtx?: string | null` parameter. `streamExecute()` pre-computes `visitorCtx` once (for the cache decision) and passes it through, so `buildQueryContext()` skips the DB call when the value is already known.

---

#### ARCH-03 — Answer Cache Key Normalization — ✅ Already Handled

`AnswerCacheService.buildKey()` already normalizes the query: `query.toLowerCase().trim().replace(/\s+/g, ' ')`. Case and whitespace variants of the same question hit the same cache entry. No change was needed.

The secondary concern — cache invalidation on KB update — remains open. If a KB document is updated, cached answers citing it remain stale until TTL expiry (1 hour).

---

#### ARCH-04 — `deleteMany` + `createMany` in Voice Transcript Is Non-Atomic — ✅ Fixed

~~`chat.controller.ts` deleted all existing messages then created new ones in two separate operations. A crash between them would silently lose all messages for that session.~~

**Resolution:** Both operations are now wrapped in `this.prisma.$transaction([...])`. They succeed or fail together.

---

#### ARCH-05 — No Circuit Breaker on LLM Calls — **OPEN**

If the DeepSeek API is down or rate-limited, every chat request fails with an unhandled error. There is no retry, no fallback response, and no graceful degradation.

**Fix:** Wrap `llmProvider.chatWithTools()` and `llmProvider.stream()` in a try/catch in the use-case. On failure, return "The AI assistant is temporarily unavailable — reach Hammad directly at [email]."

---

#### ARCH-06 — Shared Types Package Underutilized — **OPEN**

`/packages/types` exists but several DTO types are defined in the API module and not imported from the shared package in the frontend admin pages. `ConversationTurn` and `AnswerQuestionResult` are defined in the API and not exported from `@portfolio/types`.

**Fix:** Export all public API DTOs from `@portfolio/types` and import them in both the API controllers and the frontend pages.

---

#### ARCH-07 — OpenAI Embedding Dependency Undocumented — **OPEN**

`SpendGuardService` references OpenAI ada-002 embedding costs. The system depends on both DeepSeek (LLM) and OpenAI (embeddings) but CLAUDE.md only documents "LLM: DeepSeek". Removing the OpenAI key breaks embeddings silently.

**Fix:** Document the dual-provider dependency in CLAUDE.md. Evaluate whether DeepSeek's embedding API is a viable alternative to reduce provider count.

---

#### ARCH-08 — `MAX_TOOL_CALLS` Constant vs System Prompt Out of Sync — ✅ Fixed

~~`answer-question.use-case.ts` had `MAX_TOOL_CALLS = 3` while the system prompt said "Max 2 tool calls."~~

**Resolution:** Constant changed to `MAX_TOOL_CALLS = 2`. The enforced limit and the LLM guidance now match.

---

### Observability Gap — **OPEN**

There is a `/system` page and an `observability` module, but there is no evidence of structured error logging to a sink (Loki, Datadog), no distributed tracing, and no alerting on LLM failures or spend-ceiling hits. For a "living system" portfolio, the observability story should be tighter — the system page is a public showcase of the platform's health.

---

## Part III — UI/UX Review

### Summary

The "Terminal Observatory" design language is coherent and distinctive. The lime-on-dark aesthetic with Clash Display headings and JetBrains Mono labels genuinely stands out from generic templates. The chat + voice AI integration is the strongest differentiator. The issues below are polish and consistency gaps rather than fundamental design problems.

---

### What's Working Well

**SpeedDial is a strong UX pattern.** A single FAB expanding to chat and voice with a smooth Framer Motion transition is innovative. The "ringing → active → ended" state machine gives users clear feedback.

**Streaming responses feel premium.** Tokens appearing in real-time with sources displayed ahead of the text creates a sense of quality that static chatbots can't match.

**Navigation tool calls are genuinely useful.** The AI generating clickable navigation chips ("Go to Projects →") that scroll the portfolio is a feature that justifies the architecture investment.

**Admin dashboard is clean and functional.** The mono-label uppercase styling, lime active indicator, and `ink-800` sidebar read as a coherent internal tool. The conversations modal — full thread, IP hash, tool call details, source display — is genuinely better than most analytics dashboards.

**Responsive admin sidebar.** Mobile overlay drawer with backdrop blur is the right pattern. The transition is polished.

---

### Issues

#### UX-01 — Two Parallel Chat Implementations — **OPEN**

`ChatWidget.tsx` (~720 lines) and the chat panel inside `SpeedDial.tsx` (~567 lines) are separate implementations of the same chat UI — each with its own state, streaming logic, source chips, navigation chips, and feedback buttons. Bugs fixed in one don't reach the other.

**Fix:** Extract a single `<ChatPanel>` component and a `useChatSession` hook, composed inside both `ChatWidget` and `SpeedDial`.

---

#### UX-02 — Chat History Doesn't Survive Page Refresh — **OPEN**

Chat messages live in React state. A page reload clears the conversation despite the backend having full session persistence via the `chat_session` cookie.

**Fix:** On chat panel open, fetch the last N messages for the current session from a new `GET /chat/history/:sessionId` endpoint and pre-populate the message list.

---

#### UX-03 — Query Limit Creates Frustrating Dead Ends — **PARTIALLY FIXED**

The length limit has been raised from 500 → 1000 characters (SEC-07 fix), which resolves the most common false-positive case for case-study questions.

**Remaining:** The `OFF_TOPIC_REPLY` message gives no hint that the query was blocked by length or pattern — users don't know they should rephrase. The contact email in `OFF_TOPIC_REPLY` is hardcoded in the use-case file and will go stale silently.

**Fix:**
- Show a character counter in the input field when approaching 1000 chars.
- Move the contact email to `ConfigService`, not inline in the use-case constant.

---

#### UX-04 — Copy Button Has No Success Feedback — **OPEN**

The copy button on AI messages copies text to the clipboard but provides no visual confirmation.

**Fix:** Toggle the icon to a checkmark for 1.5s on successful copy.

---

#### UX-05 — Voice Call UI Is Minimal During Active Call — **OPEN**

The active call state shows a sound wave animation and a list of suggested questions. There's no speaker indicator, no live transcript, and no visual for the AI "thinking."

**Suggestions:**
- Show live transcription via ElevenLabs SDK turn events.
- Add a "speaking" vs "listening" indicator.
- Display the current AI response text as it arrives.

---

#### UX-06 — Admin Conversations Page Has No Empty State — **OPEN**

On a fresh deployment, the table renders empty with no message or call-to-action. Zeros in the stats row don't distinguish "hasn't loaded" from "no conversations yet."

**Fix:** Empty state: "No conversations yet. Share your portfolio link to see visitors here."

---

#### UX-07 — KB Management: No Bulk Import — **OPEN**

Adding the initial KB (10–20 documents) requires 10–20 sequential form submissions.

**Fix:** Accept a pasted markdown file split by `---` separator to create multiple documents in one request.

---

#### UX-08 — No Toast / Notification System in Admin — **OPEN**

Admin CRUD operations show inline error messages (string state) but success feedback is inconsistent across pages. No global notification system.

**Fix:** Add a lightweight toast provider (Sonner or a 50-line custom implementation) and standardize all mutations to `toast.success` / `toast.error`.

---

#### UX-09 — Mobile Admin Has No Current-Page Indicator — **OPEN**

The mobile top bar shows "Admin" regardless of which page is active. After navigating to "Chatbot Settings" there's no visible breadcrumb.

**Fix:** Read `pathname` in the mobile top bar and display the current page name alongside the hamburger.

---

#### UX-10 — Spend Bar Chart Has No Y-Axis Labels — **OPEN**

The 7-day spend chart in Chatbot Settings shows bars with relative heights but no dollar values. There's no way to read the actual spend amount without hover.

**Fix:** Add 2–3 labeled gridlines on the Y-axis, or display the value as a tooltip on hover/tap.

---

### Design System Compliance

CLAUDE.md design constraints are well-respected overall. Lime is used sparingly and purposefully. The one inconsistency: the admin dashboard uses `text-signal` (lime) for active nav items and also for success states in some admin pages — this approaches the "too much lime" threshold CLAUDE.md warns against.

---

## Summary Table

| ID | Severity | Area | Issue | Status |
|---|---|---|---|---|
| SEC-01 | Critical | Security | Voice transcript endpoint unauthenticated | **OPEN** |
| SEC-02 | Critical | Security | Middleware checked cookie presence, not JWT validity | ✅ Fixed |
| SEC-03 | High | Security | Adminer exposed with default credentials in dev | **OPEN** |
| SEC-04 | High | Security | Passkey registration endpoint unauthenticated | **OPEN** |
| SEC-05 | High | Security | admin-auth set action lacks CSRF origin check | **OPEN** |
| SEC-06 | Medium | Security | Streaming path bypassed spend guard | ✅ Fixed |
| SEC-07 | Medium | Security | Intent filter over-blocked legitimate queries | ✅ Fixed |
| SEC-08 | Medium | Security | Error details leaked in voice token route | ✅ Fixed |
| SEC-09 | Medium | Security | Session ID accepted from untrusted header | ✅ Fixed |
| SEC-10 | Medium | Security | Redis has no password in production | **OPEN** |
| SEC-11 | Low | Security | IP hash truncation + namespace mixing | **OPEN** |
| SEC-12 | Low | Security | `process.env` inline in cookie setter | **OPEN** |
| SEC-13 | Low | Security | JWT default weak fallback in dev compose | **OPEN** |
| ARCH-01 | High | Architecture | Streaming bypassed spend guard and answer cache | ✅ Fixed |
| ARCH-02 | Medium | Architecture | Double `buildVisitorContext` DB query in streaming path | ✅ Fixed |
| ARCH-03 | Medium | Architecture | Cache key normalization | ✅ Already handled |
| ARCH-04 | Medium | Architecture | Non-atomic delete+create for voice transcripts | ✅ Fixed |
| ARCH-05 | Medium | Architecture | No circuit breaker on LLM calls | **OPEN** |
| ARCH-06 | Low | Architecture | Shared types package underutilized | **OPEN** |
| ARCH-07 | Low | Architecture | OpenAI embedding dependency undocumented | **OPEN** |
| ARCH-08 | Low | Architecture | MAX_TOOL_CALLS constant vs system prompt out of sync | ✅ Fixed |
| UX-01 | High | UI/UX | Two parallel chat implementations (ChatWidget + SpeedDial) | **OPEN** |
| UX-02 | High | UI/UX | Chat history doesn't survive page refresh | **OPEN** |
| UX-03 | Medium | UI/UX | Query limit creates dead ends without guidance | Partially Fixed |
| UX-04 | Low | UI/UX | Copy button has no success feedback | **OPEN** |
| UX-05 | Medium | UI/UX | Voice active-call UI is minimal | **OPEN** |
| UX-06 | Low | UI/UX | Admin conversations has no empty state | **OPEN** |
| UX-07 | Low | UI/UX | KB management has no bulk import | **OPEN** |
| UX-08 | Low | UI/UX | No global toast/notification system in admin | **OPEN** |
| UX-09 | Low | UI/UX | Mobile admin has no current-page breadcrumb | **OPEN** |
| UX-10 | Low | UI/UX | Spend bar chart has no Y-axis labels | **OPEN** |
