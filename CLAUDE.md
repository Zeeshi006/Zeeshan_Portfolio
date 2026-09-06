# CLAUDE.md — Hammad Afzal Portfolio Platform

> **Read this file before touching any code.** Every constraint here is load-bearing. Do not invent alternatives mid-build.

---

## Positioning Thesis

> "The architecture IS the portfolio; 3D earns attention, the backend earns the offer."

Every technical decision must be defensible as evidence of backend/architecture skill. A recruiter reading the repo, opening the admin panel, or watching the chatbot answer questions about the codebase is using the proof — not reading a claim about it.

---

## Monorepo Structure

```
/portfolio
  /apps
    /web          → Next.js (App Router) — public site (SSR/ISR)
    /admin        → Next.js — protected admin panel (/admin route group or separate app)
  /services
    /api          → NestJS — clean-architecture backend (THE showpiece)
  /packages
    /ui           → shared components / design system
    /types        → shared TS types/DTOs (single source of truth)
    /config       → eslint, tsconfig, tailwind preset
```

Tooling: **Turborepo + pnpm workspaces**. Never propose Lerna or npm workspaces as a replacement.

---

## Tech Stack (non-negotiable — do not propose alternatives)

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js (App Router), TypeScript strict |
| Styling | Tailwind CSS + design system in /packages/ui |
| 3D | react-three-fiber + drei |
| Motion | Motion (Framer Motion) + GSAP (scroll-timeline only) |
| Backend | NestJS, clean architecture, Swagger/OpenAPI |
| DB | PostgreSQL + pgvector (single DB for content + analytics + embeddings) |
| ORM | Prisma (chosen — be opinionated, do not switch to TypeORM) |
| Cache/RT | Redis + WebSockets (Socket.IO) |
| LLM | DeepSeek V4 Flash via `LLMProvider` adapter port |
| Analytics | First-party custom pipeline + optional Umami |
| Infra | Contabo VPS, Docker Compose, nginx/Caddy, GitHub Actions CI/CD |

---

## NestJS Clean-Architecture Layering (strict)

Every NestJS module MUST follow this layer order. No business logic in controllers. No DB calls in use-cases.

```
domain/          → entities, value objects, ports (interfaces)
application/     → use-cases (orchestrate domain, call ports)
infrastructure/  → adapters (Prisma repos, LLM adapters, Redis, vector store)
presentation/    → controllers, DTOs (class-validator), Swagger decorators
```

**Modules:**
- `content` — skills, experience, projects, case studies
- `chat` — RAG pipeline, chatbot
- `analytics` — ingest + query
- `contact` — form submissions + notifications
- `auth` — admin-only JWT auth

**AI boundary rule:** the `LLMProvider` is a port (interface) in `domain/`. `DeepSeekAdapter` is its infrastructure implementation. The use-case depends only on the port. This makes the model swappable and is explicitly part of the portfolio narrative.

**API responses:** all use DTO classes decorated with `class-validator` and `@ApiProperty`. Swagger at `/api/docs` must be live and linkable.

---

## Coding Conventions

- **TypeScript strict mode everywhere** — `"strict": true` in all tsconfigs.
- **Shared types live in `/packages/types`** — no duplicating DTOs between frontend and backend.
- **No `any`** — if you need an escape hatch, use `unknown` and narrow it.
- **No barrel re-exports for the backend** — NestJS DI works better with explicit imports.
- **Prisma for all DB access** — migrations committed to source control, never auto-migrated in production.
- **Environment variables** — all accessed through a validated `ConfigService` (NestJS `@nestjs/config` with Joi/Zod validation). Never `process.env.X` inline.
- **Error handling** — NestJS exception filters at the presentation layer; use-cases throw domain errors; infrastructure translates DB errors.

---

## Design System — "Terminal Observatory" (PART II — Exact Values)

> These values are non-negotiable constraints, not suggestions. Do not substitute "nicer" defaults. The whole point is to avoid generic AI-generated UI.

### Color Tokens (CSS variables + Tailwind theme extension)

```css
--ink-900:    #0A0C10   /* page background — near-black, navy bias. NOT pure #000 */
--ink-800:    #0F1218   /* elevated surface / cards */
--ink-700:    #161A22   /* higher elevation / hover surface */
--ink-600:    #1E2430   /* borders on dark, dividers */
--line:       #232A36   /* hairline grid / subtle separators */

--text-hi:    #E8ECF2   /* primary text — not pure white */
--text-mid:   #99A2B2   /* secondary text */
--text-lo:    #5C6573   /* tertiary / captions / mono metadata */

--signal:     #C6FF3A   /* THE accent — signal-lime. Sparingly: CTAs, active states, key numbers, live pulse */
--signal-dim: #8FB82A   /* pressed/hover variant of signal */
--signal-ink: #14210A   /* text ON the lime accent — never black */

--warn:       #FFB020   /* amber — only for system-status warnings */
--ok:         #3FB950   /* green — only for operational/success */
--danger:     #F85149   /* red — only for errors */
```

**Accent discipline (non-negotiable):** `--signal` lime appears on **at most ~5% of any viewport**. Primary CTA, one active nav indicator, key metrics, the "live" pulse dot, link hovers. If a screen looks lime-heavy, remove lime until it doesn't. Overuse destroys the aesthetic.

### Typography (exact — self-host fonts)

- **Display / headings:** **Clash Display** (weight 500–600, tracking -0.02em). Fallback: General Sans or Satoshi. **NEVER Inter, Roboto, Arial, Space Grotesk** for display.
- **Body / UI:** **General Sans** or **Satoshi** at 400/500.
- **Mono / "system":** **JetBrains Mono** or **Geist Mono** — for all numbers, labels/tags, code, timestamps, section indices (`01 / EXPERIENCE`), analytics readouts.

#### Type Scale (desktop, 16px root)

| Token | Size | Line Height | Font | Weight | Tracking |
|---|---|---|---|---|---|
| display-xl | 4.5rem | 1.0 | Clash Display | 600 | -0.02em |
| display-l | 3.0rem | 1.05 | Clash Display | 600 | -0.02em |
| h2 | 1.75rem | 1.2 | Clash Display | 500 | — |
| h3 | 1.25rem | 1.3 | General Sans | 500 | — |
| body | 1.0rem | 1.7 | General Sans | 400 | — |
| small | 0.875rem | 1.5 | General Sans | 400 | — |
| mono-label | 0.75rem | 1.4 | JetBrains Mono | 500 | 0.08em (uppercase) |

Mobile: scale `display-xl` → ~2.5rem, `display-l` → ~2rem. Never below 11px.

### Layout & Spacing

- **Grid:** 12-column, max content width 1200px, gutters 24px.
- **Spacing scale (8px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Use only these values.
- **Section rhythm:** 96–128px vertical padding desktop, 64px mobile.
- **Structural grid motif:** faint 1px grid in `--line` color (opacity ~0.4) in hero and section dividers.
- **Asymmetry:** left-aligned, off-center compositions. Section titles in a narrow left column, content in a wider right.
- **Section indexing:** each section gets a mono label `01 / EXPERIENCE` — small, `--text-lo`, top-left.

### Component Anatomy

**Buttons:**
- Primary: `--signal` fill, `--signal-ink` text, radius max 6px, `scale(0.98)` on press, hover → `--signal-dim`.
- Secondary: transparent, 1px `--ink-600` border, `--text-hi` text, hover border → `--text-lo`.
- **Never more than one primary (lime) button visible per viewport.**

**Cards (projects, case studies):**
- `--ink-800` background, 1px `--ink-600` border, radius 12px, padding 24px.
- Top-right: tiny mono status/tech tag.
- Hover: border brightens to lime-tinted line, `translateY(-4px)`, mono "→ VIEW" appears. **No glow.**
- Card content: project name (h3), one-line role, mono tech-chips row, key outcome metric (mono, lime number).

**Nav:**
- Fixed top, transparent over hero, gains `--ink-900` bg + hairline bottom border on scroll.
- Left: monogram/name in mono. Center/right: section links.
- Active section: 2px lime underline indicator that slides between items (layout animation).
- Right: ⌘K hint chip (mono).

**The "live" signal:**
- Single small pulsing lime dot + mono text like `● 3 ONLINE`. Nav or footer. One flourish only.

**Skills visualization:**
- NOT a flat tag cloud. Groups = resume categories. Within each: mono chips. Optional 5-segment proficiency bar (segments in `--text-lo`, filled in lime) — only if honest.

### Motion (exact rules)

Library: **Motion (Framer Motion)** for React. GSAP only if scroll-timeline is needed. **All motion respects `prefers-reduced-motion` — provide instant/no-animation fallback.**

- **Page load hero:** staggered reveal — headline words rise + fade in sequence (stagger 60ms, 400ms each, ease-out). Total under 1.2s.
- **Scroll reveals:** sections fade + translateY(24px) as they enter viewport (once). Children stagger 50ms.
- **Hover:** cards translateY(-4px) 200ms ease-out; links get lime underline wiping left-to-right; buttons `scale(0.98)` on active.
- **Number counters:** count up from 0 when scrolled into view (mono, lime).
- **Nav active indicator:** 2px lime underline slides between sections (Framer Motion layout animation).

**Forbidden motion:** parallax-everything, bouncy spring overload, infinite looping background animations (except the single live-dot pulse), anything running while off-screen.

### 3D Hero (restrained, performance-budgeted)

Library: react-three-fiber + drei. One focused 3D accent — abstract instrument (rotating wireframe/particle structure, reactive point-field, or subtle shader). Monochrome ink palette with lime accent points. **Not a scene. Not interactive world-building.**

**Hard performance rules (enforced at every PR):**
1. Lazy/dynamic import — hero text + CTAs render immediately, 3D mounts after first paint.
2. Pause render loop when hero off-screen (IntersectionObserver) and `document.hidden`.
3. Cap `dpr` to `[1, 2]`; limit FPS; throttle on low-power devices.
4. Static fallback (CSS gradient mesh) for `prefers-reduced-motion` and low-end mobile.
5. **Lighthouse mobile Performance > 90 is a launch gate. 3D must never block LCP.**

### Accessibility (launch gate)

- Semantic HTML, landmark regions, logical heading order.
- All interactive elements keyboard-reachable; 2px lime focus ring.
- Color contrast: `--text-hi` on `--ink-900` passes WCAG AA. Never rely on lime alone to convey meaning.
- `prefers-reduced-motion` fully honored — no reveals, no counters, static hero.
- Alt text on all imagery; aria-labels on icon-only controls.

---

## Forbidden List (never introduce these)

**Fonts (display):** Inter, Roboto, Arial, Space Grotesk — these read as "AI default output."

**Colors:** purple/violet accents, pure `#000000` background, pure white `#FFFFFF` text, glowing neon, gradient-everything.

**Motion:** parallax-everything, bouncy springs everywhere, looping background animations, motion not gated behind `prefers-reduced-motion`.

**UI patterns:** full explorable 3D world, visitor accounts, guestbook/comments, multi-tenant features.

**Architecture violations:** business logic in controllers, DB calls in use-cases, inline `process.env` access, `any` types.

---

## RAG Chatbot Rules

- **Strictly grounded** — only answers from the knowledge base. Responds "I don't have that info — but you can ask Hammad directly" for unknowns.
- **Model:** DeepSeek V4 Flash via the `LLMProvider` adapter port. Never hardcode the provider.
- **Vector store:** pgvector in the existing Postgres — no separate vector DB service.
- **Guardrails:** rate-limit per IP (Redis), max tokens, profanity filter, hard scope boundary.
- **UX:** streaming word-by-word responses. Source chips under answers ("based on: Sales CRM case study").

---

## Analytics Rules

- First-party analytics endpoint: `/analytics/collect` — page views, scroll depth, CTA clicks, chatbot events.
- Stored in Postgres. No PII, no cookies banner required (anonymous/aggregate only).
- Admin dashboard shows: visitors over time, top sections by scroll depth, chatbot usage, most-asked questions, conversion events, live "online now" via WebSocket.

---

## Build Phase Reference

| Phase | Goal | Outcome |
|---|---|---|
| **0** | Monorepo + infra skeleton | Ugly but wired API-driven page is live |
| **1** | Content + Admin CRUD | Real portfolio live — start applying to jobs |
| **2** | Design pass + case studies | Looks senior |
| **3** | 3D hero + motion | The hook |
| **4** | RAG chatbot | The differentiator |
| **5** | Analytics + polish | Complete |

> Never block the job hunt on later phases. Phase 1 is shippable.

---

## Per-Area Supplemental Rules

### `services/api` (NestJS)
- All responses: DTO classes with `class-validator` + `@ApiProperty`.
- Global pipes: `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`.
- Global exception filter — map domain errors to HTTP status codes.
- Health endpoint at `/health` (Terminus).
- Swagger at `/api/docs` — link publicly.

### `apps/web` (Next.js public)
- App Router only. No Pages Router.
- Server Components by default; Client Components only where interactivity is required.
- ISR for all content pages. On-demand revalidation triggered by admin publish action.
- No `fetch` with `no-cache` in Server Components — rely on ISR revalidation tags.

### `apps/admin` (Next.js admin)
- Protected by middleware — redirect unauthenticated to `/admin/login`.
- Single-admin auth (JWT + httpOnly cookie or NextAuth with credentials provider).
- CRUD for: skills, experience, projects, case studies, KB documents.
- "Publish" button triggers `revalidateTag` on the public site.
- KB management tab: add/edit KB documents → POST to `/chat/kb` → triggers re-embedding.
- Analytics dashboard tab with charts.
