# Product Document — Hammad Afzal Portfolio Platform

**Version:** Current (hero/living-system branch)  
**Date:** 2026-06-10  
**Purpose:** Feature inventory, implementation briefs, and enhancement suggestions

---

## Platform Overview

A full-stack portfolio platform built as a technical showcase. The product is simultaneously a recruiter-facing portfolio website and a live demonstration of backend/architecture competence. Every feature is designed to be defensible as evidence of engineering skill, not just functional.

**Stack:** Next.js (App Router) + NestJS (clean architecture) + PostgreSQL (pgvector) + Redis + DeepSeek LLM + ElevenLabs Voice AI + Turborepo monorepo.

---

## Architectural Observations

> Notes on patterns worth preserving and invariants to maintain as the codebase grows.

**Visitor context as a single computed value.** The last 30 minutes of analytics events are computed once per request and passed through the call chain — `buildQueryContext` accepts `precomputedVisitorCtx` so the DB is hit exactly once. This pattern must be maintained if new callers are added.

**Streaming spend estimation.** The streaming path estimates token counts from response character length (`chars / 4`), since the stream adapter does not return a usage summary. If the DeepSeek adapter is ever updated to return a `usage` field in the final stream chunk, consume it instead of the estimate. A TODO comment should live in the stream adapter to flag this.

**Redis spend key TTL.** Daily spend keys use a 48h TTL, which is correct for the daily ceiling. However, the 7-day bar chart reads the last 7 days of keys. If you ever extend the history window, add an explicit cleanup job for keys older than the retention period — don't rely on TTL alone.

**Port discipline.** `ILLMProvider` and `IKBRepository` are domain ports — use-cases depend on these interfaces, never on concrete adapters. This discipline must be maintained for every new infrastructure dependency. Direct imports of Prisma, Redis, or ElevenLabs inside application-layer code are violations.

---

## Feature Inventory

---

### 1. Portfolio Public Website

**What it is:** The visitor-facing portfolio site with sections for hero, skills, experience, projects, case studies, GitHub activity, availability, and contact.

**Implementation brief:**
- Next.js App Router with ISR (Incremental Static Regeneration). All content pages are statically generated and updated on-demand when the admin publishes changes via `revalidateTag`.
- Server Components by default; Client Components only where interactivity is needed (Nav, Hero, sections with scroll animations).
- Content is sourced from the NestJS API at build time and via ISR revalidation — not hardcoded.
- The Hero section uses `react-three-fiber` + `drei` for a 3D particle/wireframe scene, lazy-loaded after first paint with a CSS grid fallback for `prefers-reduced-motion` and WebGL failures.
- Section reveals use Framer Motion with staggered `translateY(24px)` + fade-in animations, gated behind `prefers-reduced-motion`.
- Number counters (metrics, stats) count up from 0 on scroll entry using Framer Motion, displayed in JetBrains Mono.

**Enhancement suggestions:**
- Add a `/blog` or `/writing` section for technical posts (MDX-based) — demonstrates technical communication and adds SEO value.
- Implement a "what I'm currently working on" live status block that pulls from a GitHub issue or a simple CMS field — makes the portfolio feel alive between deployments.
- Add `og:image` generation per project/case study using `@vercel/og` or a Puppeteer screenshot — improves link previews when sharing on LinkedIn.

---

### 2. Projects & Case Studies

**What it is:** Detailed pages for portfolio projects and longer-form case studies, reachable from the main portfolio sections and directly via URL.

**Implementation brief:**
- Dynamic routes: `apps/web/src/app/projects/[slug]/` and `apps/web/src/app/case-studies/[slug]/`.
- Content fetched from the NestJS `content` module, which serves `Project` and `CaseStudy` Prisma models.
- Pages use `generateStaticParams` + ISR — pre-rendered at build time, revalidated on admin publish.
- The AI chatbot's `openProject` tool call can navigate visitors directly to these pages.
- Case studies are merged into the projects model — a single `Project` entity with an optional `caseStudy` extended content block.

**Enhancement suggestions:**
- Add a "Related Projects" section at the bottom of each project page, powered by pgvector similarity search against the KB embeddings — shows the RAG pipeline doing useful work beyond the chatbot.
- Add a "Technologies used" tag cloud per project with hover-to-filter interaction on the main projects list.
- Track time-on-page per project/case study in the analytics pipeline to know which stories recruiters spend the most time reading.

---

### 3. RAG Chatbot (Text)

**What it is:** An AI assistant embedded in the portfolio that answers questions about Hammad's work, grounded exclusively in a curated knowledge base.

**Implementation brief:**
- The chat pipeline: user query → intent filter (1000-char limit, injection/off-topic patterns) → cache check → embed query (OpenAI ada-002) → pgvector similarity search (top 5 KB docs) → build system prompt with context + visitor browsing signals → LLM call (DeepSeek V3/Flash) → tool call validation → persist to DB → SSE stream response to client.
- `AnswerQuestionUseCase` orchestrates the full pipeline. It depends on `ILLMProvider` (a domain port) and `IKBRepository` (another port) — the LLM model and vector store are both swappable without touching the use-case.
- SSE streaming via `POST /chat/stream`; falls back to `POST /chat` (JSON) if SSE fails. Tokens stream word-by-word; sources are yielded in the first SSE event so the client can display them before the full answer arrives.
- Both the streaming and non-streaming paths check the answer cache before calling the LLM and write to it after (bypassed when visitor context is present). Cache keys are normalized (lowercase, trimmed, collapsed whitespace).
- Both paths record LLM spend via `spendGuard.recordSpend()` fire-and-forget after the response completes. The streaming path estimates token counts from response character length.
- Visitor context: the last 30 minutes of analytics events (sections viewed, projects opened, CTAs clicked) are computed once per request and injected into the system prompt as a personalisation signal.
- The LLM can call `navigateToSection` and `openProject` tools (max 2 calls). Tool arguments are validated against a whitelist before being executed.
- Rate limiting: per-IP and per-session sliding window (1 min / 1 hour / 1 day). Session ID is resolved from the httpOnly cookie only.
- Daily spend ceiling: $0.50 USD, enforced via Redis INCRBYFLOAT accumulator covering both streaming and non-streaming requests.

**Enhancement suggestions:**
- **Multi-turn context restoration:** On chat panel open, fetch the last N messages for the session from the backend and pre-populate the UI so conversations survive page refresh.
- **Query clarification:** Instead of the generic `OFF_TOPIC_REPLY` when the intent filter blocks a query, ask a clarifying question: "That's outside my scope — were you asking about [related topic]?"
- **Suggested follow-up questions:** After each answer, generate 2–3 follow-up question chips using a lightweight LLM prompt to keep the conversation moving.
- **KB-aware confidence:** If the similarity search returns no published docs above a threshold cosine distance, respond with "I don't have detailed info on that — here's who to ask directly" rather than citing weak matches.
- **Config-driven contact email:** `OFF_TOPIC_REPLY` hardcodes an email address in the use-case file. Move it to `ConfigService` so it doesn't go stale silently. Consider a `ReplyProvider` interface so the reply text can vary by environment (staging vs. production).
- **Session replay for debugging:** When a chat response is poor, the admin currently only sees the final message. Capture the exact retrieved KB chunks + cosine scores + final assembled system prompt in a hidden admin log per request. Without this, improving RAG quality is guesswork.

---

### 4. AI Voice Agent

**What it is:** A real-time conversational voice interface powered by ElevenLabs Conversational AI, accessible via the SpeedDial FAB.

**Implementation brief:**
- The flow: visitor clicks "Start Call" → browser calls `POST /api/voice-token` (Next.js API route, server-side) → the route exchanges the ElevenLabs API key for a signed WebSocket URL → browser's `@elevenlabs/client` SDK opens a WebRTC session directly to ElevenLabs using only the signed URL (API key never leaves the server). Errors are logged server-side; the client receives a generic unavailability message.
- The SpeedDial component manages states: `idle → ringing → active → ended`. On `active`, a sound wave animation plays.
- ElevenLabs sends conversation turn events (user speech, agent response). These are accumulated in component state.
- On conversation end (disconnect), the full transcript is POSTed to `POST /chat/transcript` on the NestJS backend, which stores it as a `ChatSession` (type: `voice`) + `ChatMessage` records in an atomic `$transaction`. Same model as text chat sessions.
- Conversation analytics events are tracked (`voice_call_start`, `voice_call_end`, `voice_call_duration`).

**Enhancement suggestions:**
- **Transcript authentication (P0):** `POST /chat/transcript` currently accepts POSTs from any source without authentication. Add HMAC signature verification (see SEC-01 in review.md).
- **Graceful degradation:** Add a "Voice not supported" fallback for browsers without WebRTC (`RTCPeerConnection` detection) or on slow connections (`navigator.connection.effectiveType`). Currently, unsupported browsers attempt the call and fail silently.
- **Live transcript display during call:** ElevenLabs SDK provides turn events in real time. Display them as a scrolling transcript in the call panel.
- **Post-call summary:** After the call ends, use the stored transcript to generate a brief summary ("You asked about X, Y, Z") and display it in the panel before it closes.
- **Configurable agent personality:** Move ElevenLabs agent configuration (voice, first message, system prompt) to the Voice Settings admin page so it can be updated without a deployment.

---

### 5. SpeedDial FAB

**What it is:** The primary access point for the AI features — a floating action button that expands to offer both text chat and voice call options.

**Implementation brief:**
- A single fixed FAB (52px, z-301) at the bottom-right. On click, it expands to reveal two sub-buttons: "Ask AI" (opens chat panel) and "Start Call" (opens voice panel).
- Both panels animate in/out with Framer Motion. Only one panel is visible at a time.
- The chat panel is a full chat interface: streaming responses, source chips, navigation chips, feedback thumbs, copy button, and suggested prompts.
- The voice panel shows a phone-call-style UI with call state and live prompts.
- Note: a separate `ChatWidget.tsx` implements the same chat panel independently. Both exist simultaneously — see UX-01 in review.md.

**Enhancement suggestions:**
- **Consolidate ChatWidget and SpeedDial (P1):** Extract a shared `<ChatPanel>` component and `useChatSession` hook used by both, eliminating the duplicate implementation. Duplicated UI logic will inevitably diverge and cause inconsistent behavior.
- **Persistent panel state:** Remember which panel was last open and restore it when the user returns to the page.
- **Unread indicator:** Show a notification dot on the FAB if there's a pending response the user hasn't acknowledged.

---

### 6. Admin Dashboard

**What it is:** A protected web interface for managing all portfolio content, monitoring AI usage, and administering the system.

**Implementation brief:**
- Protected by Next.js middleware (`middleware.ts`) which verifies the `admin_token` JWT using `jose` — signature and expiry are checked on every protected route. Invalid or expired tokens clear the cookie and redirect to `/admin/login`.
- The backend enforces auth independently via `JwtAuthGuard` on all mutation endpoints.
- The sidebar navigation covers 11 sections. On desktop it's a 224px fixed sidebar; on mobile it's an overlay drawer with a backdrop.
- All admin pages are Client Components fetching data from the NestJS API via a shared `adminFetch` helper.

**Sub-features:**

#### 6a. Content CRUD (Skills, Experience, Projects, Site Content)
Separate admin pages for each content type. Each page provides a form to create/edit/delete records, with a "Publish" action that triggers ISR revalidation on the public site via `revalidateTag`.

#### 6b. Knowledge Base Management
Full CRUD for KB documents (title, content, published status). Each create/update triggers re-embedding via the NestJS API. Includes a citation analytics panel (bar chart of top 30 most-cited documents) and an in-page chatbot test tool (uses the admin-only `POST /chat/test` endpoint that bypasses rate limits).

**Enhancement suggestions:**
- **Bulk import:** Support pasting markdown or uploading a file to create multiple KB documents at once, split by `---` separator.
- **Embedding health check:** Show embedding status per document (last embedded at, similarity score against a test query) so admins can identify stale or poorly-matched documents.
- **KB document categories/tags:** Allow grouping documents by tag so the chatbot can filter by tag for specific query types.

#### 6c. Conversation Analytics
**What it is:** A paginated view of all chat sessions (text and voice) with filtering, search, and full thread view.

**Implementation brief:** Fetches from `GET /chat/conversations` with filters (text/voice), search by message content, and pagination (20/page). Clicking a conversation opens a modal showing the full thread with timestamps, source chips, tool call details, and IP hash. Stats row shows today's totals (text, voice, all) and all-time counts.

**Enhancement suggestions:**
- **Export conversations:** Download filtered conversations as CSV or JSON for offline analysis.
- **Sentiment tagging:** Auto-tag conversations as "interested" / "exploratory" / "off-topic" using a lightweight LLM classification on the first 3 messages.
- **Conversion tracking:** Link conversations to a `conversion_event` to measure chatbot-to-contact-form conversion rate.

#### 6d. Chatbot Settings (Spend & IP Management)
**What it is:** Monitoring and control panel for LLM spend, IP blocklist, and query analytics.

**Implementation brief:** Shows today's spend vs. ceiling (with % used), a 7-day bar chart of daily spend from Redis, the IP blocklist (add/remove), and a top-queries list (most common questions sampled from 5,000 recent analytics events). Spend tracking covers both streaming and non-streaming traffic.

**Enhancement suggestions:**
- **Spend alert:** Send an email/webhook notification when daily spend exceeds 80% of ceiling.
- **Query clustering:** Cluster similar queries semantically and show cluster labels — "recruiter intro questions", "technical architecture questions", "project specifics".
- **Rate limit tuning:** Expose `RATE_LIMIT_PER_MINUTE/HOUR/DAY` as editable fields in the UI.

#### 6e. Voice Settings
**What it is:** Configuration guide and connection test for the ElevenLabs voice agent.

**Implementation brief:** Primarily an informational page explaining required env vars (`ELEVENLABS_AGENT_ID`, `ELEVENLABS_API_KEY`) and the data flow. Includes a "Test Connection" button that calls `/api/voice-token` and shows success/failure.

**Enhancement suggestions:**
- **Agent configuration:** Expose ElevenLabs agent settings (first message, voice selection, system prompt) as editable fields via the ElevenLabs Management API.
- **Voice transcript stats:** Show voice-specific conversation metrics (average call duration, most common topics).

#### 6f. GitHub Integration
**What it is:** Displays GitHub activity (contributions, repositories) pulled from the GitHub API.

**Implementation brief:** A NestJS `github` module with a cached GitHub API adapter. TTL-cached in Redis (default 1 hour, configurable via `GITHUB_CACHE_TTL_SECONDS`).

**Enhancement suggestions:**
- **Selective display:** Let the admin pin specific repositories to the public portfolio page and hide others.
- **Contribution goal tracking:** Set a weekly commit goal and show progress.

#### 6g. Analytics Dashboard
**What it is:** First-party analytics showing visitor behavior across the portfolio.

**Implementation brief:** Events are collected via `POST /analytics/collect` (page views, scroll depth, CTA clicks, chatbot events, conversion events). Stored in the `AnalyticsEvent` Prisma model. The dashboard shows: visitors over time, top sections by scroll depth, chatbot usage, conversion events. Live "online now" count via WebSocket (Socket.IO).

**Enhancement suggestions:**
- **Funnel view:** Show the sequence landing → section views → chatbot engagement → contact form as a funnel chart.
- **Cohort analysis:** Compare behavior of visitors who engaged with the chatbot vs. those who didn't.
- **Bot filtering:** Detect and filter known bot user agents from analytics to avoid inflated counts.
- **Analytics rate limiting (P0):** `POST /analytics/collect` currently has no rate limit. Even a loose threshold (100 req/min per IP) prevents flooding the analytics DB and skewing visitor context. This is a data integrity risk in addition to a resource one.

#### 6h. Security Management
**What it is:** Passkey management and security overview for the admin.

**Implementation brief:** Shows registered passkeys (device name, created at, last used, transports). Allows deleting credentials. The admin authenticates via WebAuthn (`@simplewebauthn/server`) — phishing-resistant, backed by platform biometrics or hardware keys. JWTs are issued on successful authentication (2h expiry). The Next.js middleware verifies the JWT signature and expiry on every admin request.

**Enhancement suggestions:**
- **Passkey registration guard (P1):** Add `@UseGuards(JwtAuthGuard)` to `beginRegistration` (see SEC-04 in review.md). An open enrollment endpoint means anyone who can reach the API could enroll their own credential before a legitimate admin does. Low effort; high impact.
- **Login audit log:** Show the last 20 login events (timestamp, credential used, success/failure) to detect unauthorized access attempts.
- **Session revocation:** Allow manually invalidating all active JWT sessions when a device is lost.
- **2FA fallback hardening:** Document and test the password→passkey enrollment flow to ensure a recovery path exists if all passkeys are lost.

---

### 7. Authentication System

**What it is:** Admin authentication using WebAuthn passkeys (FIDO2/CTAP) with a password-based fallback for initial setup and passkey enrollment.

**Implementation brief:**
- Primary: WebAuthn via `@simplewebauthn/server`. Registration and authentication options are generated server-side; challenges are stored in Redis with a 5-minute TTL.
- The RP ID and origin are configurable via `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` env vars.
- On successful authentication, a JWT is issued (`sub: 'admin'`, 2h expiry).
- The frontend stores the JWT in an httpOnly cookie via `/api/admin-auth` (Next.js API route), never in localStorage.
- All backend admin endpoints are guarded by `JwtAuthGuard`. The Next.js middleware additionally verifies the JWT using `jose` before rendering any admin page.

**Enhancement suggestions:**
- **JWT refresh:** Add a refresh token mechanism so the admin session can be extended without re-authenticating — 2h is short for a multi-hour work session.
- **Passkey registration guard:** Add `@UseGuards(JwtAuthGuard)` to `beginRegistration` so only an already-authenticated admin can enroll a new device (see SEC-04 in review.md).

---

### 8. Analytics Pipeline

**What it is:** A first-party, privacy-preserving analytics system that tracks visitor behavior without cookies or PII.

**Implementation brief:**
- Client-side: `AnalyticsProvider.tsx` tracks page views, `SessionTracker.tsx` manages session IDs (stored in `sessionStorage`, not cookies), `ReadTracker.tsx` tracks scroll depth per section.
- Events are sent to `POST /analytics/collect` on the NestJS backend — currently no rate limit on this endpoint.
- Session IDs are random hex strings with no PII linkage.
- The analytics data feeds the chatbot's visitor context system — browsing signals from analytics events are injected into the LLM system prompt for personalisation.
- Live "online now" count: WebSocket (Socket.IO) broadcasts active session counts to the admin dashboard.

**Enhancement suggestions:**
- **Rate limit `/analytics/collect` (P0):** No rate limiting exists on this endpoint. It can be flooded to inflate visitor counts, exhaust DB write capacity, and corrupt the visitor context that personalises LLM responses. A Redis-backed limit (e.g., 100 req/min per IP) is sufficient.
- **Bot filtering:** Detect and filter known bot user agents to avoid inflating visitor counts.
- **Event deduplication:** Section view events can fire multiple times for the same section during a scroll session. Deduplicate by (sessionId, section, 5-minute window) before storing.

---

### 9. Rate Limiting System

**What it is:** Multi-window, per-IP and per-session rate limiting for the chat endpoints using Redis sorted sets.

**Implementation brief:**
- Three sliding windows: per-minute (10), per-hour (40), per-day (100) — all configurable via env vars.
- Implemented with Redis sorted sets (`zremrangebyscore` + `zadd` + `zcard`). Each request adds a timestamped entry; stale entries are evicted before counting.
- IPv6 addresses are bucketed to /64 prefix to prevent trivial bypass via address rotation.
- IP blocklist is a Redis Set (`SISMEMBER blocklist`) checked before the sliding window logic.
- Session identity is resolved from the httpOnly cookie only — client-supplied headers are not trusted for rate-limit bucketing.
- Both IP and session are checked independently — a shared IP (NAT/VPN) doesn't consume the session budget of unrelated visitors.

**Enhancement suggestions:**
- **Adaptive rate limiting:** Temporarily tighten limits for IPs that have previously hit the blocklist, even after removal.
- **Rate limit headers:** Return `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers so the frontend can display a countdown timer.
- **Admin exemption:** Allow the admin (JWT-authenticated) to bypass rate limits entirely, not just the test endpoint.

---

### 10. Spend Guard System

**What it is:** Token-level LLM cost tracking and daily spend ceiling enforcement.

**Implementation brief:**
- Cost rates for DeepSeek (input: $0.00014/1k tokens, output: $0.00028/1k tokens) and OpenAI ada-002 embeddings ($0.00002/1k tokens) — configurable via env vars.
- Daily accumulator: Redis key `spend:YYYY-MM-DD`, incremented atomically via `INCRBYFLOAT`. TTL: 48h.
- Ceiling: $0.50/day (configurable via `CHAT_DAILY_LIMIT_USD`).
- Both streaming and non-streaming paths record spend fire-and-forget after the response completes. The streaming path estimates token counts from response character length since the stream adapter does not return a usage summary.
- When the ceiling is hit, both endpoints return a graceful message directing visitors to contact Hammad directly.
- 7-day spend history for admin dashboard: reads `spend:YYYY-MM-DD` keys for the last 7 days.

**Enhancement suggestions:**
- **Tiered ceiling:** Implement a warning threshold (e.g., 80% of ceiling sends a notification) separate from the hard cutoff.
- **Cost attribution by query type:** Tag spend by query intent category so it's visible which types of questions cost the most.
- **Usage summary from stream adapter:** If the DeepSeek stream adapter ever returns a `usage` field in the final chunk, consume it instead of the character-length estimate for accurate tracking. Add a TODO in the stream adapter to flag this.
- **Redis key cleanup:** Daily spend keys use 48h TTL which is correct. If the history window is ever extended beyond 7 days, add an explicit cleanup job for keys older than the retention period — don't rely on TTL alone.

---

### 11. Knowledge Base & Embedding System

**What it is:** A managed collection of documents about Hammad's work that power the RAG chatbot. Documents are embedded into pgvector and retrieved by semantic similarity.

**Implementation brief:**
- `KBDocument` Prisma model: title, content (full text), published flag, embedding (`vector(1536)` via pgvector).
- Embeddings generated via OpenAI ada-002 (1536-dimensional). Stored directly in PostgreSQL — no separate vector database.
- On create/update, the `kb.controller.ts` calls the embedding service, stores the result, and the document is immediately available for similarity search.
- `IKBRepository` is a domain port; the pgvector implementation is in infrastructure. The vector store is swappable.
- Similarity search: cosine distance (`<=>`) via Prisma raw query, top 5 results. Only `published: true` documents surface in RAG responses.
- Citation analytics: a raw SQL query aggregates `sources` JSON arrays from `ChatMessage` records to count how often each document is cited.

**Enhancement suggestions:**
- **Chunk-level embeddings (P1):** Split large documents into ~500-token paragraph-level chunks with overlap, and embed each chunk separately. Currently a 2000-word case study competes with a 50-word skill description for the same 5 similarity slots — the relevant paragraph of the long document may be diluted. This is the highest-impact RAG improvement available with no pipeline change.
- **Hybrid search:** Combine cosine similarity with BM25 keyword search for better recall on exact terms (tech names, company names, version numbers) that semantic search misses.
- **Embedding cache invalidation on KB update:** When a KB document is updated, invalidate the answer cache for queries that cited it. Currently, stale cached answers persist until TTL expiry (1 hour).
- **Auto-populate from portfolio content:** When a Project or Experience record is published, automatically create a corresponding KB document — eliminates manual duplication.

---

### 12. System / Observatory Page

**What it is:** A public-facing page (`/system`) that displays live operational metrics of the portfolio platform — making the infrastructure itself part of the portfolio.

**Implementation brief:**
- Fetches metrics from the NestJS `observability` module.
- Includes: API health, database status, Redis status, uptime, recent analytics events as a live stream via WebSocket.
- The nav links to `/system` with a pulsing live dot indicator.

**Enhancement suggestions:**
- **Readiness probe for the chat pipeline:** The existing `/health` endpoint likely checks DB/Redis connectivity. Add `/health/chat` that performs a real similarity search against a fixed test query and checks the cache is reachable. This prevents deploying a broken RAG pipeline that passes the DB/Redis health check but fails on the embedding or pgvector query path.
- **Structured logging with request IDs:** Add a `X-Request-ID` header propagated through all services (Next.js → NestJS → stream). Currently tracing a slow or failed chat request across logs requires timestamp matching. A correlated request ID makes this trivial.
- **Latency percentiles:** Show p50/p95/p99 response times for the chat endpoint — demonstrates awareness of performance engineering.
- **Cost-per-query:** Display average LLM cost per chat query in real time — turns the spend guard into a portfolio talking point.
- **Incident history:** Show the last 5 deployment events or health check failures — signals production-grade thinking.
- **Embed in admin:** Surface the same metrics on the admin dashboard homepage so it's the first thing seen on login.

---

### 13. Contact Form

**What it is:** A contact form for visitors to reach Hammad directly.

**Implementation brief:**
- NestJS `contact` module handles form submissions: name, email, message fields.
- Submissions are stored in the database and optionally trigger a notification (email/webhook).
- The chatbot's escalation path links directly to the contact section.

**Enhancement suggestions:**
- **Chat-to-contact prefill:** When the chatbot escalates, offer a prefilled contact form with the conversation context already included — reduces friction from "I'll just close this tab."
- **Availability-aware messaging:** Show a response-time estimate based on the admin's configured availability status.

---

### 14. CI/CD Pipeline

**What it is:** Automated testing, building, and deployment via GitHub Actions with Docker and Ansible.

**Implementation brief:**
- Three workflows: `ci.yml` (runs on PR — lint, type-check, unit tests, E2E tests), `pr.yml` (PR checks), `deploy.yml` (triggers on main merge — builds Docker images, pushes to GHCR, deploys via Ansible to Contabo VPS).
- Production compose uses `ghcr.io/${GITHUB_REPOSITORY_OWNER}/portfolio-api:latest` and the equivalent web image.
- Caddy handles TLS termination and reverse proxy for both the web and API domains.
- Ansible automates server provisioning.

**Enhancement suggestions:**
- **Smoke tests post-deploy:** Add a post-deploy step that calls `/health`, `/health/chat`, `GET /chat/kb`, and `POST /chat` with a fixed test query and asserts the response. Catches broken RAG pipelines and misconfigured env vars immediately after deploy.
- **Canary deploys:** Keep the old container running for 60s while health checks pass on the new one before switching traffic — eliminates brief downtime.
- **Dependency update automation:** Add Renovate or Dependabot to keep Next.js, NestJS, and the ElevenLabs SDK updated automatically.

---

## Feature Priority Matrix (Open Enhancements)

| Priority | Enhancement | Impact | Effort |
|---|---|---|---|
| P0 | Authenticate voice transcript endpoint (SEC-01) | Critical — data poisoning and integrity risk | Medium |
| P0 | Rate limit `/analytics/collect` | Critical — DB flood + visitor-context corruption risk | Low |
| P1 | Guard passkey registration with JWT (SEC-04) | High — open enrollment window before first passkey | Low |
| P1 | Consolidate ChatWidget + SpeedDial (UX-01) | High — duplicate logic will diverge | Medium |
| P1 | Chat history restoration on page refresh (UX-02) | High — improves AI assistant usability | Medium |
| P1 | Chunk-level KB embeddings | High — single biggest RAG quality improvement | Medium |
| P1 | Session replay for RAG debugging | High — without it, improving RAG quality is guesswork | Medium |
| P1 | Suggested follow-up questions in chat | Medium — increases engagement | Low |
| P2 | Readiness probe for chat pipeline (`/health/chat`) | Medium — prevents silent post-deploy failures | Low |
| P2 | Structured logging with request IDs | Medium — makes cross-service debugging tractable | Low |
| P2 | Live transcript during voice call (UX-05) | Medium — improves voice UX | Medium |
| P2 | Analytics bot filtering | Medium — improves data quality | Low |
| P2 | KB auto-populate from portfolio content | Medium — reduces admin friction | Medium |
| P2 | Post-deploy smoke tests | Medium — improves reliability | Low |
| P2 | Graceful degradation for voice (WebRTC detection) | Medium — prevents silent failures on unsupported browsers | Low |
| P3 | Bulk KB import | Low-medium — admin convenience | Low |
| P3 | Conversion funnel analytics | Low — portfolio enhancement | Medium |
| P3 | Blog/writing section | Low — SEO + portfolio depth | High |
| P3 | JWT refresh for admin sessions | Low — admin convenience | Medium |
| P3 | Redis spend key cleanup job | Low — future-proofing | Low |
