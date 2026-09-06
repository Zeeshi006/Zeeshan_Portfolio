# Product Requirements Document
## Hammad Afzal — Engineering Portfolio Platform

**Version:** 2.1
**Owner:** Hammad Afzal
**Positioning thesis:** *The portfolio is itself a case study in how I architect systems. The 3D/animation layer earns attention; the backend earns the offer.*

---

## 0. The One-Sentence Pitch

A full-stack, API-driven portfolio where every piece of content (skills, experience, projects, case studies) is served from a NestJS clean-architecture backend, managed through a custom admin panel, observed through real analytics, and explorable through a RAG chatbot grounded in a knowledge base about my work — wrapped in a performant, tastefully animated Next.js frontend with a restrained 3D hero.

This is deliberately over-engineered for a portfolio, and that is the point. A recruiter for a $3.6k–5.4k/mo remote backend role does not need a CMS to read my bio. But when they open the admin panel, see the clean module boundaries in the repo, watch the chatbot answer "how did he build the voice agents?" from a real RAG pipeline, and notice the analytics dashboard tracking their own visit — they are no longer reading claims about my architecture skills. They are using them.

---

## 1. Goals & Non-Goals

### 1.1 Primary Goal
Convert visitors (recruiters, hiring managers, technical interviewers, potential freelance clients) into a conversation, by *demonstrating* — not asserting — backend architecture, real-time, and applied-AI capability.

### 1.2 Success Metrics
- **Engagement:** median session > 90s; > 40% of visitors scroll past the hero; > 15% open at least one case study.
- **Chatbot:** > 10% of visitors send at least one message; answer relevance rated "good" in self-review on a 30-question eval set.
- **Conversion:** measurable contact events (form submit, calendar booking, resume download, email click).
- **Performance (the backend-engineer flex):** Lighthouse Performance > 90 on mobile *despite* the 3D hero; LCP < 2.5s; CLS < 0.1; 3D scene never blocks first paint.
- **Career outcome (the real metric):** inbound interest / interview callbacks attributable to the site.

### 1.3 Non-Goals (v1)
- Not a blog/CMS platform for the world — single-author only.
- Not multi-tenant, not a product. (Resist the urge; scope is the enemy here.)
- No user accounts for visitors (only the single admin auth).
- No e-commerce, no payments.
- 3D is an *accent*, not a game. We are not building an explorable 3D world (those win Awwwards but bury backend engineers under months of GLSL work that proves the wrong skill).

---

## 2. Audience & Strategic Framing

| Visitor | What they want in 10 seconds | What converts them |
|---|---|---|
| Non-technical recruiter | "Is this person legit and senior?" | Clean visual polish, clear role/seniority, easy contact |
| Technical hiring manager | "Can he architect real systems?" | Case studies with tradeoffs, the admin panel, the repo |
| Interviewer (pre-call prep) | "What do I ask him about?" | Deep case studies, the chatbot to probe details |
| Freelance client | "Can he ship and is he reachable?" | Project outcomes, contact, responsiveness signals |

**Framing principle:** every "wow" element must double as evidence. A Three.js hero that's just decoration is a liability for a backend candidate ("why did he spend time on this?"). A Three.js hero that is *performance-budgeted, lazy-loaded, and degrades gracefully* is evidence of systems thinking. Same pixels, opposite signal. We always take the second path and we say so (a small "how this site is built" note).

---

## 3. Information Architecture (Sections)

Ordered as the visitor scrolls. Everything marked **[API]** is served dynamically from the backend and editable in the admin panel.

1. **Hero** — name, **one-line copy from the options below (pick one)**, restrained 3D accent, primary CTAs (View Work / Case Studies / Resume). **[API]** for the headline copy.

   **Hero copy options (choose one; all are API-editable):**
   - Option A: "I build AI voice agents that act on live calls, self-learning knowledge bases, and systems that stay standing under scale. Engineering with intention."
   - Option B: "Real-time backends. LLM agents. Systems that work."
   - Option C: "Backend engineer obsessed with architecture. Shipping voice agents, WebAuthn, and zero-knowledge systems."

   (Pick based on tone: A = human-forward, B = terse, C = positioned-focused. All replace the old generic "Architecture-first backend engineer building real-time, AI-native systems" line.)

2. **About / Story** — short, principle-focused statement (not a journey narrative). Show *how you think* rather than *where you came from*. **[API]** content. Pick one direction below:

   **About section options (choose one; all are API-editable):**

   - **Option A (Systems-focused):** "I design systems to last. That means clean boundaries, anticipating failure, and building for scale from the start. Backend-first, but comfortable full-stack. Most excited about real-time architectures and the intersection of AI and infrastructure."

   - **Option B (Problem-focused):** "I solve hard problems in real-time systems and applied AI. Voice agents that work, knowledge bases that learn, architectures that don't collapse under load. I obsess over the constraints — latency, reliability, cost — because that's where the real engineering lives."

   - **Option C (Principle-focused):** "Backend engineer who builds with intention. I believe in clean architecture, measured decisions, and shipping things that actually work. Hands-on with real-time, events, and LLM-powered systems. Uncomfortable with technical debt."

   *Do not include educational background, job journey, or 'self-taught' framing. Let the projects and case studies prove competence. The About section is for showing your engineering philosophy, not your resumé.*
3. **Skills** — grouped exactly like the resume (Backend, Frontend, Data, Messaging/Real-time, AI & Agents, Architecture). Visualized, not a flat list. **[API]**
4. **Experience** — timeline (TapTap, Disrupt/PureKeep, 360Xpert). **[API]**
5. **Projects** — card grid; each card → detail view. **[API]**
6. **Case Studies** — the centerpiece. Long-form, 2–4 deep dives (see §4). **[API]**
7. **The AI Chatbot** — "Ask my portfolio anything" — persistent launcher + a featured inline section explaining it's RAG over a KB. (see §6)
8. **Contact** — form **[API write]**, email, social links, optional calendar booking, resume download.
9. **Footer** — quiet, links, "built with…" honest stack credits. A small linked note: "Built with NestJS + Next.js + pgvector; see the code & live Swagger" that expands to a collapsible tech stack detail. The admin panel, Swagger docs, and case studies themselves demonstrate the architecture — don't oversell it here.

---

## 4. Case Studies — the centerpiece

This is where you out-compete every "card grid + GitHub link" portfolio. Each case study is a structured document, served from the backend, following a consistent template:

**Template (per case study):**
- **Context** — what the product was, who it served, your role and scope.
- **The Problem** — the actual engineering challenge (not "build a CRM" but "agents needed to act on live calls with sub-second tool execution").
- **Architecture** — a diagram (you can render these as SVG/Mermaid served from the backend), module boundaries, why clean architecture / adapter / strategy here.
- **Key Decisions & Tradeoffs** — the part interviewers love. "We chose Azure Service Bus over Kafka because X; the cost was Y." Honesty about tradeoffs reads as senior.
- **Hard Parts** — the genuinely difficult bit (the self-learning KB loop; the WebAuthn attestation/assertion ceremony; real-time meeting-assist with Vexa).
- **Outcome** — what shipped, what you'd do differently.

**Recommended v1 case studies (pick 2–3, in priority order):**
1. **AI-Native Sales CRM voice agents + self-learning KB** — your single strongest, most 2026-relevant story. ElevenLabs/Twilio, tool-calling, transcription mining → KB articles, debrief agent → LMS tasks. This *is* your differentiator.
2. **PureKeep — WebAuthn passkeys + E2EE + self-contained binary** — proves security depth and low-level rigor.
3. **Vanaways CRM — modular monolith with Azure Service Bus** — proves you architect multi-portal systems with real messaging.

*Note: The case studies are where you tell the journey-and-growth story if needed. The About section is purely about your current principles and how you approach problems. Don't overlap these — About is philosophy, case studies are proof.*

Note: the portfolio *itself* becomes an implicit 4th case study via its architecture, admin panel, and live Swagger docs.

---

## 5. System Architecture

### 5.1 Topology (monorepo)
A single repo with clear package boundaries — the structure is part of the demonstration.

```
/portfolio
  /apps
    /web         → Next.js (App Router) — public site (SSR/ISR)
    /admin       → Next.js or same app, /admin route group — protected CMS
  /services
    /api         → NestJS — clean architecture, the content + AI backend
  /packages
    /ui          → shared components / design system
    /types       → shared TS types/DTOs (single source of truth)
    /config      → eslint, tsconfig, tailwind preset
```

Tooling: pnpm or Turborepo workspaces (cheaper to reason about than Lerna here; mention you've used Lerna, used Turborepo for this — shows range).

### 5.2 Backend (NestJS — the showpiece)
- **Clean architecture layers:** `domain` (entities, value objects) → `application` (use-cases, ports) → `infrastructure` (Postgres repos, LLM adapter, vector store adapter) → `presentation` (controllers, DTOs, Swagger).
- **Adapter pattern at the AI boundary:** an `LLMProvider` port with a `DeepSeekAdapter` implementation, so the model is swappable (DeepSeek today, anything tomorrow). *This directly mirrors the architecture story on your resume — live proof.*
- **Modules:** `content` (skills/experience/projects/case-studies), `chat` (RAG), `analytics` (ingest + query), `contact` (form + notifications), `auth` (admin only).
- **API:** REST with full Swagger docs at `/api/docs` — link this publicly. Swagger docs are themselves a portfolio artifact.
- **DB:** PostgreSQL (content + analytics) via TypeORM or Prisma. Pick one and be opinionated.
- **Cache/real-time:** Redis for caching hot content + rate-limiting the chatbot; optional WebSocket channel for a live "visitors online" counter (a tasteful real-time flex tied to your Socket.IO experience).

### 5.3 Frontend (Next.js)
- App Router, mostly Server Components; ISR for content so it's fast and SEO-friendly but still API-driven (revalidate on admin publish via on-demand revalidation — another nice detail to mention).
- Data fetched from the NestJS API at build/revalidate time; client components only where interactivity is needed (chatbot, 3D, animations).
- Design system in `/packages/ui`.

### 5.4 Admin Panel
- Protected route group, single-admin auth (credentials or a provider; keep it simple, add MFA to echo your resume — small touch, real signal).
- CRUD for every content type, with a markdown/rich editor for case studies.
- "Publish" triggers on-demand ISR revalidation of the public site.
- A KB management tab: add/edit KB documents → triggers re-embedding for the chatbot (see §6).
- Analytics dashboard tab (see §7).

### 5.5 Deployment (your DevOps proof — uses the Contabo VPS)
- **This is where the portfolio doubles as your "just enough DevOps" track.** Deploy the whole stack on the Contabo VPS with Docker Compose: web, api, postgres, redis, vector store, nginx reverse proxy, automatic TLS (Caddy or nginx + certbot).
- CI/CD via GitHub Actions: lint → test → build images → deploy on push to main.
- Mention this honestly in "How This Site Is Built." Self-hosting the whole thing on a VPS (vs. one-click Vercel) is exactly the signal that separates you from frontend-only portfolios.
- Keep a fallback: frontend can also deploy to Vercel if the VPS has issues — but the *story* is the self-hosted stack.

---

## 6. The RAG Chatbot ("Ask my portfolio")

### 6.1 Concept
A chat widget grounded in a knowledge base about you — your projects, decisions, skills, even FAQ ("Is he open to remote? What's his notice period? Has he done Kafka?"). It must **only** answer from the KB and gracefully decline/deflect off-topic or unknown questions. This mirrors the self-learning KB you built at TapTap — call that parallel out explicitly; it's a strong narrative.

### 6.2 Model
- **DeepSeek V4 Flash** (`deepseek-v4-flash`) via the OpenAI-compatible API — cheap (~$0.14/M input, far less on cache hits), fast, good enough for grounded Q&A. Access it through the `LLMProvider` adapter so it's swappable.
- Use a consistent system-prompt prefix to maximize DeepSeek's prompt-cache discount (cache hits are ~98% cheaper) — a cost-engineering detail worth mentioning.

### 6.3 RAG Pipeline
1. **Ingest:** KB documents authored in the admin panel (your bio, per-project deep facts, FAQ).
2. **Chunk + embed:** on save, chunk and embed. Embeddings via an embedding model (note: confirm DeepSeek embedding availability at build time; if unavailable, use a dedicated embedding provider/open model and store vectors — keep this behind a port too).
3. **Store:** **pgvector** in your existing Postgres (avoids running a separate vector DB — fewer moving parts, one less thing to host, and "I used pgvector instead of standing up a separate vector store" is a sensible-engineer signal). Alternative: Qdrant if you want to show vector-DB familiarity.
4. **Retrieve:** on a query, embed → similarity search top-k chunks → assemble grounded prompt.
5. **Generate:** DeepSeek with strict instructions to answer only from context, cite which project/section, and say "I don't have that info — but you can ask Hammad directly" otherwise.
6. **Guardrails:** rate-limit per IP (Redis), max tokens, profanity/abuse filter, and a hard scope boundary so it can't be turned into a free general-purpose LLM.

### 6.4 UX
- Persistent launcher button + a featured inline demo in the chatbot section with 3–4 suggested prompts ("How did he build the voice agents?", "Is he good with real-time systems?", "What's his strongest project?").
- Streaming responses (word-by-word) — you've done this before; it reads as polished.
- Show retrieved-source chips under answers ("based on: Sales CRM case study") — transparency + proof it's真 RAG, not a hardcoded script.

---

## 7. Analytics

### 7.1 Two layers
1. **Your own first-party analytics** (the build-it-yourself flex): a lightweight `/analytics/collect` endpoint that ingests page views, section scroll-depth, CTA clicks, chatbot opens/messages, case-study reads. Stored in Postgres. Privacy-respecting (no PII, no cookies banner needed if you keep it anonymous/aggregate). Surfaced in the admin dashboard with charts.
   - This is a genuine mini-project that proves data-pipeline + dashboard skills. Strongly recommended over only using a third party.
2. **Optional third-party** (Plausible/Umami self-hosted, or PostHog) as a sanity check / richer funnels without building everything. Self-hosting Umami on the same VPS keeps the "I run my own infra" story consistent.

### 7.2 Admin dashboard shows
Visitors over time, top sections by scroll-depth, chatbot usage + most-asked questions (super useful — tells you what recruiters care about), conversion events, live "online now" via WebSocket.

---

## 8. UI / UX & Aesthetic Direction

**Design tension to resolve:** beauty vs. backend-credibility. The resolution: **"engineered elegance."** Refined, dark, technical, precise — not maximalist 3D spectacle. Think a developer-tool/observability aesthetic (the polish of Linear, Vercel, Railway dashboards) rather than a creative-agency showreel. This signals "I build serious systems" while still looking exceptional.

### 8.1 Direction
- **Theme:** dark-first, deep near-black base (not pure #000) with one confident accent (e.g. an electric cyan or a warm amber — pick one, commit). Optional light mode later.
- **Typography:** a distinctive display font for headlines (avoid Inter/Roboto/Arial and the overused Space Grotesk) paired with a clean, slightly technical mono or grotesk for body and code. Use a monospace for "system" details (versions, timestamps, the analytics numbers) to reinforce the engineering vibe.
- **Layout:** structured grid with intentional grid-breaks; generous negative space; section transitions that feel deliberate. Asymmetry over centered-everything.
- **Texture/atmosphere:** subtle grain, faint grid lines, depth via layered shadows/gradients — not flat.

### 8.2 The 3D layer (restrained, performance-budgeted)
- **One** focused 3D moment in the hero — e.g. an abstract animated mesh/particles/shader, or a subtle interactive object that reacts to cursor. Not a full scene, not a character to walk around.
- **Hard rules (the backend-engineer discipline, stated on-site):**
  - 3D loads *after* first paint, lazy/dynamic import; hero text and CTAs render instantly without it.
  - Pause the render loop when the hero is off-screen (IntersectionObserver) and when tab is hidden.
  - Cap FPS / device-pixel-ratio; provide a reduced-motion + low-power fallback (static gradient or CSS animation).
  - Respect `prefers-reduced-motion`.
- Library: react-three-fiber + drei; GSAP or Motion (Framer Motion) for the 2D scroll/entrance animations.

### 8.3 Motion
- One well-orchestrated page-load reveal (staggered) beats scattered micro-interactions.
- Scroll-triggered section reveals; magnetic/hover states on CTAs and project cards; smooth scroll.
- Always gated behind reduced-motion.

### 8.4 Accessibility & responsiveness
- Mobile-first; the 3D and heavy animation must degrade cleanly on low-end mobile (where many recruiters will first open the link).
- Semantic HTML, keyboard-navigable, sufficient contrast, focus states. (Accessibility is itself a seniority signal.)

---

## 9. Suggested Additional Features (beyond your list)

Prioritized; not all are v1. **[P1]** = build now, **[P2]** = nice soon, **[P3]** = later/optional.

- **[P1] "How This Site Is Built" section** — links to public repo + live Swagger docs. Turns the site into its own case study. Cheap, huge signal.
- **[P1] Public Swagger/OpenAPI docs** — `/api/docs` live and linked. Proof of API discipline.
- **[P1] Resume download that's always in sync** — serve the latest resume from the backend; one source of truth.
- **[P1] SEO + OpenGraph** — proper meta, dynamic OG images per case study (Next.js OG image gen). Recruiters share links; make them look good in Slack/LinkedIn.
- **[P1] Contact form with real notification** — email (SMTP, like your CRM) + store submissions in admin. Optional Telegram/Slack ping to you.
- **[P2] Live "system status" / uptime widget** — small, honest, observability-flavored; reinforces infra story.
- **[P2] Chatbot "most asked questions" surfaced publicly** — social proof + utility.
- **[P2] Calendar booking** (Cal.com embed) — removes friction for recruiters to book a call.
- **[P2] Theme toggle** (dark/light) with persisted preference.
- **[P2] Command palette (⌘K)** — navigate sections, trigger chatbot, download resume. Developer-tool aesthetic; recruiters who are devs will smile.
- **[P3] Blog / "writings"** — only if you'll actually write (ties into your X/LinkedIn content plan; could share a backend with those posts).
- **[P3] GitHub activity integration** — pull repo stats/contributions via GitHub API (cache server-side).
- **[P3] Multi-language** (English + maybe one more) — only if targeting specific markets.
- **[P3] A/B-ish hero copy via admin** — you can change positioning without redeploy; minor but shows the API-driven point.

**Deliberately cut / cautioned:**
- Full explorable 3D world — wrong skill to spend months proving.
- Visitor accounts / comments — scope creep, spam surface.
- Turning the chatbot into a general assistant — keep it scoped to you.

---

## 10. Build Phases (sequenced so it's usable early)

**Phase 0 — Foundations (repo + infra skeleton)**
Monorepo, NestJS clean-architecture skeleton with one `content` module, Postgres, Next.js app talking to the API, Docker Compose locally, deploy pipeline to Contabo. Buy domain + VPS here. *Outcome: an ugly but fully wired API-driven page is live.*

**Phase 1 — Content + Admin (the core proof)**
All content types modeled, admin CRUD, public site rendering everything from API via ISR, Swagger docs live, resume download. *Outcome: a real, content-managed portfolio is live and shareable even before fancy UI.* ← You can start applying to jobs with this.

**Phase 2 — Design pass + case studies**
Apply the full PART II aesthetic direction, write 2–3 deep case studies, SEO/OG images. The "How This Site Is Built" becomes a small linked note in the footer (not a nav item or standalone section). *Outcome: it looks senior.*

**Phase 3 — The 3D hero + motion**
Add the performance-budgeted 3D accent and orchestrated animations, with all the degradation rules. *Outcome: the hook.*

**Phase 4 — Chatbot (RAG)**
pgvector, ingestion from admin KB, DeepSeek adapter, streaming UI, guardrails, source chips. *Outcome: the differentiator + a live AI case study.*

**Phase 5 — Analytics + polish**
First-party analytics pipeline + admin dashboard, live visitor counter, command palette, status widget, final perf tuning to hit Lighthouse > 90. *Outcome: complete.*

> **Sequencing principle:** the site is *live and useful for job-hunting after Phase 1*. Everything after that increases conversion and signal, but you are never blocked from applying while you build. This protects the real goal (the job) from the fun goal (the build).

---

## 11. Tech Stack Summary

| Layer | Choice | Why (and what it signals) |
|---|---|---|
| Monorepo | Turborepo + pnpm | Modern, shows range beyond Lerna |
| Frontend | Next.js (App Router), TypeScript | SSR/ISR, SEO, your React polish |
| Styling | Tailwind + design system in /packages/ui | Consistency, speed |
| 3D | react-three-fiber + drei | Restrained, performant |
| Motion | Motion (Framer Motion) + GSAP | Orchestrated reveals |
| Backend | NestJS, clean architecture, Swagger | THE showpiece; mirrors resume |
| DB | PostgreSQL + pgvector | Content + analytics + embeddings, one DB |
| ORM | Prisma or TypeORM | Pick one, be opinionated |
| Cache/RT | Redis + WebSockets | Rate-limit, cache, live counter |
| LLM | DeepSeek V4 Flash via LLMProvider adapter | Cheap, swappable, OpenAI-compatible |
| Analytics | First-party (custom) + optional Umami | Build-it flex + sanity check |
| Infra | Contabo VPS, Docker Compose, nginx/Caddy, GitHub Actions | THE DevOps proof |

---

## 12. Risks & Mitigations

- **Risk: scope explosion delays the job hunt.** → Phase 1 is shippable and you apply from there. 3D and chatbot are enhancements, not blockers.
- **Risk: 3D tanks mobile performance and hurts your credibility.** → Strict perf budget, lazy load, reduced-motion fallback, Lighthouse gate before launch.
- **Risk: chatbot hallucinates or gets jailbroken into a free LLM.** → Strict grounding, scope guardrails, rate limits, decline-on-unknown.
- **Risk: DeepSeek API/region latency (infra is China-based).** → Adapter makes it swappable; cache aggressively; acceptable for low-volume portfolio traffic.
- **Risk: self-hosted VPS goes down during a recruiter visit.** → Uptime monitoring, Docker restart policies, and Vercel fallback for the frontend if needed.
- **Risk: perfectionism on design.** → Time-box Phase 2; "senior and clean" beats "award-winning and unfinished."

---

## 13. Definition of Done (v1 launch)

- [ ] Live on custom domain, HTTPS, self-hosted on Contabo.
- [ ] All content served from API and editable in admin.
- [ ] 2–3 complete case studies with architecture diagrams + tradeoffs.
- [ ] RAG chatbot answering from KB with source chips and guardrails.
- [ ] First-party analytics dashboard working in admin.
- [ ] Public Swagger docs + "How This Site Is Built" + repo link.
- [ ] Lighthouse: Performance > 90 mobile, Accessibility > 95.
- [ ] Resume download in sync, contact form delivering, OG images render.
- [ ] Reduced-motion and low-power fallbacks verified on a real low-end phone.

---

# PART II — Design System ("Terminal Observatory")

> This section is written as a hard specification, not inspiration. When building with Claude Code, treat every value here as a constraint. Do not substitute "nicer" defaults. The whole point is to avoid generic AI-generated UI; that only happens if these values are followed exactly.

## D.0 Concept

A backend + AI engineer's portfolio should feel like a well-instrumented system you are *observing* — telemetry, precision, restraint — not a creative-agency showreel. Dark ink base, one confident signal-color accent, a structural grid, monospace for anything numeric or "system-level," and motion that feels like data settling into place rather than decoration. Distinctive without being loud. The discipline (one accent, sparse use, performance budget) is itself part of the message.

## D.1 Color tokens (exact)

Dark-first. These are the canonical values — define them as CSS variables / Tailwind theme tokens.

```
--ink-900:  #0A0C10   /* page background — near-black with a navy bias, NOT pure #000 */
--ink-800:  #0F1218   /* elevated surface / cards */
--ink-700:  #161A22   /* higher elevation / hover surface */
--ink-600:  #1E2430   /* borders on dark, dividers */
--line:     #232A36   /* hairline grid / subtle separators */

--text-hi:  #E8ECF2   /* primary text (not pure white) */
--text-mid: #99A2B2   /* secondary text */
--text-lo:  #5C6573   /* tertiary / captions / mono metadata */

--signal:   #C6FF3A   /* THE accent — signal-lime. Used sparingly: CTAs, active states, key numbers, the live pulse */
--signal-dim: #8FB82A /* pressed/hover variant of accent */
--signal-ink: #14210A /* text color when placed ON the lime accent (never black) */

--warn:     #FFB020   /* amber, only for system-status warnings */
--ok:       #3FB950   /* green, only for "operational"/success status */
--danger:   #F85149   /* red, only for errors */
```

Accent discipline (non-negotiable): signal-lime appears on **at most ~5% of any viewport**. Primary CTA, one active nav indicator, key metrics, the "live" pulse dot, link hovers. Everything else is ink + text greys. If a screen looks lime-heavy, remove lime until it doesn't. Overuse kills the whole aesthetic.

Light mode: optional, ship in a later phase. If built, invert to a warm off-white (`#F7F8F5`) base, keep signal-lime but darken to `--signal-dim` for contrast, text goes to near-ink. Do not block launch on it.

## D.2 Typography (exact)

Three roles. Self-host the fonts (better performance + privacy; ties to your "self-hosted infra" story).

- **Display / headings:** a sharp grotesk with character. Use **Clash Display** (or **Space Mono** is NOT for display). If Clash is unavailable, fallback **General Sans** or **Satoshi**. Weight 500–600 for headlines. Tight tracking (-0.02em). Do NOT use Inter/Roboto/Arial/Space Grotesk for display.
- **Body / UI:** **General Sans** or **Satoshi** at 400/500. Clean, slightly geometric, readable.
- **Mono / "system":** **JetBrains Mono** or **Geist Mono**. Used for: all numbers (metrics, years, counts), labels/tags, code, timestamps, section indices (e.g. `01 / EXPERIENCE`), the analytics readouts, anything that should read as "telemetry."

Type scale (desktop, rem assuming 16px root):
```
display-xl  4.5rem  / line 1.0  / Clash 600 / tracking -0.02em   (hero headline)
display-l   3.0rem  / line 1.05 / Clash 600                       (section titles)
h2          1.75rem / line 1.2  / Clash 500
h3          1.25rem / line 1.3  / General Sans 500
body        1.0rem  / line 1.7  / General Sans 400
small       0.875rem/ line 1.5
mono-label  0.75rem / line 1.4  / JetBrains Mono 500 / tracking 0.08em / uppercase
```
Mobile: scale display-xl down to ~2.5rem, display-l to ~2rem. Never below 11px anywhere.

## D.3 Layout & spacing

- **Grid:** 12-column, max content width 1200px, gutters 24px. Generous margins on desktop (let it breathe).
- **Spacing scale (8px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Use these only.
- **Section rhythm:** large vertical padding between sections (96–128px desktop, 64px mobile).
- **Structural grid motif:** a faint 1px grid or hairline column guides (`--line` color) visible in the background of the hero and section dividers — reinforces the "instrument panel" feel. Very subtle (opacity ~0.4).
- **Asymmetry:** prefer left-aligned, off-center compositions over everything centered. Section titles can sit in a narrow left column with content in a wider right column.
- **Section indexing:** each section gets a mono label like `01 / EXPERIENCE`, `02 / PROJECTS` — small, `--text-lo`, top-left of the section.

## D.4 Component anatomy (build these exactly)

**Buttons**
- Primary: signal-lime fill, `--signal-ink` text, no radius beyond `6px`, mono or medium sans label, subtle scale(0.98) on press. Hover → `--signal-dim`.
- Secondary: transparent, 1px `--ink-600` border, `--text-hi` text, hover border → `--text-lo`.
- Never more than one primary (lime) button visible per viewport.

**Cards (projects, case studies)**
- `--ink-800` background, 1px `--ink-600` border, radius 12px, padding 24px.
- Top-right corner: a tiny mono status/tech tag.
- Hover: border brightens to a lime-tinted line, a subtle upward translate (4px), and a mono "→ VIEW" appears. No glow.
- Each card carries: project name (h3), one-line role, mono tech-chips row, key outcome metric (mono, lime number).

**Nav**
- Fixed top, transparent over hero, gains `--ink-900` bg + hairline bottom border on scroll.
- Left: monogram/name in mono. Center/right: section links. Active section underlined with a 2px lime indicator that slides between items.
- A ⌘K hint chip on the right (mono).

**The "live" signal**
- A single small pulsing lime dot + mono text like `● 3 ONLINE` (from the WebSocket counter) in the nav or footer. This is the one "alive" flourish. Tasteful, not a casino.

**Skills visualization**
- Not a flat tag cloud. Group into the resume's categories, each category a row; within it, skills as mono chips. Optionally a small proficiency indicator (a 5-segment bar in `--text-lo`, filled segments in lime) — but only if honest about levels.

**Code/architecture blocks**
- Case studies render architecture as either an inline SVG/Mermaid diagram or a mono "tree" of the module structure. Syntax-highlight any code in the ink palette with lime as the single highlight color.

## D.5 Motion (exact rules)

Library: **Motion (Framer Motion)** for React; reserve GSAP only if a scroll-timeline needs it. All motion respects `prefers-reduced-motion` (provide instant/no-animation fallback).

- **Page load (hero):** one orchestrated, staggered reveal. Headline words rise + fade in sequence (stagger 60ms, 400ms each, ease-out). Mono labels type-in or fade slightly after. Total under ~1.2s. This is the single biggest "wow" moment — invest here, keep the rest subtle.
- **Scroll reveals:** sections fade + translate-up 24px as they enter viewport (once, not every time). Stagger children by 50ms.
- **Hover:** cards translate-up 4px (200ms ease-out); links get a lime underline that wipes in left-to-right; buttons scale(0.98) on active.
- **Number counters:** metrics count up from 0 when scrolled into view (mono, lime). Round all displayed numbers.
- **Nav active indicator:** 2px lime underline slides between sections (layout animation).
- **Forbidden:** parallax-everything, bouncy spring overload, infinite looping background animations (except the single live-dot pulse), anything that runs while off-screen.

## D.6 The 3D hero (restrained, performance-budgeted — spec)

One focused 3D accent, not a scene. Recommended: an **abstract instrument** — e.g. a slowly rotating wireframe/particle structure, a reactive point-field, or a subtle shader plane that reacts to cursor. It should read as "signal/telemetry," monochrome ink with lime points.

Hard performance rules (state these on the site in the "How This Site Is Built" note — the discipline IS the flex):
- Lazy/dynamic import; render hero text + CTAs **immediately**, 3D mounts after first paint.
- Pause the render loop when hero is off-screen (IntersectionObserver) and when `document.hidden`.
- Cap `dpr` to `[1, 2]` and target/limit FPS; throttle on low-power devices.
- Provide a static fallback (CSS gradient mesh or still image) for `prefers-reduced-motion` and low-end mobile.
- 3D must never block LCP. Lighthouse mobile Performance > 90 is a launch gate.

Stack: react-three-fiber + drei. Keep geometry light; instance particles; no heavy GLTF models.

## D.7 Accessibility (launch gate)
- Semantic HTML, landmark regions, logical heading order.
- All interactive elements keyboard-reachable with visible focus (a 2px lime focus ring).
- Color contrast: text-hi on ink-900 passes AA; never rely on lime alone to convey meaning.
- `prefers-reduced-motion` fully honored (no reveals, no counters animating, static hero).
- Alt text on all imagery; aria-labels on icon-only controls; the chatbot fully operable by keyboard and screen reader.

---

# PART III — Claude Code Build Playbook

> How to actually build this in VS Code with Claude Code, so the output matches PART II instead of drifting into generic UI.

## C.1 Repo + CLAUDE.md first

Before writing features, create the monorepo skeleton (PART I §5.1) and a root `CLAUDE.md`. Claude Code reads `CLAUDE.md` automatically as standing context — this is where the design system lives so every prompt inherits it.

Put in `CLAUDE.md`:
- The positioning thesis (one line): "The architecture IS the portfolio; 3D earns attention, the backend earns the offer."
- The full PART II token tables (colors, type scale, spacing) verbatim — these are non-negotiable.
- The accent-discipline rule (lime ≤5% of viewport).
- The "forbidden" lists (no Inter/Roboto/Space Grotesk; no purple-on-white; no glow/neon; no parallax-everything).
- Stack decisions from PART I §11 so it never proposes alternatives mid-build.
- Coding conventions: TypeScript strict, clean-architecture layering for the NestJS side, shared types in `/packages/types`.

A per-area `CLAUDE.md` in `apps/web` and `services/api` can add local rules (e.g. "all API responses use DTO classes with class-validator").

## C.2 Build order (matches PART I phases — ship-early sequencing)

Work phase by phase. After each, commit and (from Phase 0) deploy, so the site is live and job-huntable from Phase 1 onward.

- **Phase 0 — Foundations:** scaffold monorepo, NestJS clean-arch skeleton + one `content` module, Postgres, Next.js app consuming the API, Docker Compose, deploy to Contabo, domain + TLS. Outcome: ugly-but-wired live page.
- **Phase 1 — Content + Admin:** model all content types, admin CRUD, public site renders everything via ISR, Swagger at `/api/docs`, resume download. ← Start applying to jobs here.
- **Phase 2 — Design pass + case studies:** apply PART II fully, write 2–3 case studies, SEO/OG images. "How This Site Is Built" moves to a quiet footer note — not a nav section.
- **Phase 3 — 3D hero + motion:** PART II §D.5/§D.6 with all degradation rules; Lighthouse gate.
- **Phase 4 — RAG chatbot:** pgvector, KB ingestion from admin, DeepSeek V4 Flash via LLMProvider adapter, streaming UI, source chips, guardrails.
- **Phase 5 — Analytics + polish:** first-party analytics pipeline + admin dashboard, live counter, ⌘K palette, status widget, final perf tuning.

## C.3 Prompting Claude Code well (specific to this project)

- **Anchor to the spec every time:** "Build the hero per PART II §D.2 type scale and §D.6 3D rules. Use the exact tokens in CLAUDE.md. Do not introduce new colors or fonts."
- **One component at a time, then review the rendered result** before moving on. Don't ask it to build 8 sections in one shot — you lose control of the aesthetic.
- **Make it show you, not just tell you:** after building UI, have it run the dev server and screenshot / open in browser so you can judge against PART II.
- **Guard the performance gate explicitly:** "After the 3D hero, run Lighthouse mobile; if Performance < 90, fix before continuing."
- **For the backend, demand the layering:** "Implement the chat module in clean-architecture layers: domain port `LLMProvider`, infrastructure `DeepSeekAdapter`, application use-case `AnswerQuestion`, presentation controller. No business logic in the controller."
- **For the hero copy:** the positioning is no longer generic "architecture-first" language. Use one of the three hero-copy options from PART I §3. If the visitor doesn't immediately understand what you *build* (voice agents, knowledge bases, systems) from the first 10 seconds, trim it until they do.
- **For the About section:** avoid biographical narrative ("started in EE, became self-taught, now focused on architecture"). Instead, show how the candidate *thinks about problems* — systems thinking, constraints, pragmatism, or what excites them technically. Let the work prove the story.
- **Keep it honest:** never let it invent metrics for case studies or skills proficiency. Real numbers only.

## C.4 Figma (optional, only if you want a design artifact)

You are a solo dev with no design-team handoff, so Figma is optional. If you want it anyway: build the UI in code first (above), preview in browser, then use Claude Code's `generate_figma_design` (Code-to-Canvas) to push the rendered UI into Figma as editable layers for refinement. Setup: `claude mcp add --transport http figma https://mcp.figma.com/mcp`, then `/mcp` to authenticate. Note the free plan caps Code-to-Canvas at ~6 tool calls/month; a Professional plan with a Dev/Full seat is needed for real iteration. Do not block the build on this.

## C.5 Definition of done
See PART I §13. Add: `CLAUDE.md` reflects the final token values; Lighthouse mobile Performance > 90 and Accessibility > 95; reduced-motion + low-power fallbacks verified on a real low-end phone; lime-accent discipline visually audited on every section.
