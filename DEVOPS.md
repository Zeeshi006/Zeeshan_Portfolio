# DevOps Guide — Hammad Afzal Portfolio Platform

> This document explains the full deployment pipeline end to end. Read it before touching infrastructure. Every tool here has a specific job — nothing is included for the sake of it.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Why Each Service Exists](#2-why-each-service-exists)
3. [Full Deployment Flow Diagram](#3-full-deployment-flow-diagram)
4. [Phase 1 — One-Time VPS Setup (Ansible)](#4-phase-1--one-time-vps-setup-ansible)
5. [Phase 2 — CI Pipeline (GitHub Actions)](#5-phase-2--ci-pipeline-github-actions)
6. [Phase 3 — Build & Deploy Pipeline (GitHub Actions)](#6-phase-3--build--deploy-pipeline-github-actions)
7. [Phase 4 — Runtime on VPS (Docker Compose)](#7-phase-4--runtime-on-vps-docker-compose)
8. [Local Development Setup](#8-local-development-setup)
9. [Simulating Production Locally](#9-simulating-production-locally)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Multi-Project VPS Setup](#11-multi-project-vps-setup)
12. [Maintenance & Operations](#12-maintenance--operations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER MACHINE                            │
│                                                                     │
│   git push → main branch                                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GITHUB (Cloud)                                 │
│                                                                     │
│  ┌─────────────────┐   ┌──────────────────────────────────────┐    │
│  │  GitHub Actions │   │  GitHub Container Registry (GHCR)    │    │
│  │                 │   │                                      │    │
│  │  ci.yml         │   │  ghcr.io/{owner}/portfolio-api:latest│    │
│  │  pr.yml         │──▶│  ghcr.io/{owner}/portfolio-web:latest│    │
│  │  deploy.yml     │   │                                      │    │
│  └─────────────────┘   └──────────────────────────────────────┘    │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │  SSH + docker compose pull
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTABO VPS (Ubuntu)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Docker Internal Network                    │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐   │   │
│  │  │ Postgres │  │  Redis   │  │  NestJS   │  │ Next.js  │   │   │
│  │  │ pgvector │  │ 7-alpine │  │    API    │  │   Web    │   │   │
│  │  │  :5432   │  │  :6379   │  │   :3001   │  │  :3000   │   │   │
│  │  └──────────┘  └──────────┘  └───────────┘  └──────────┘   │   │
│  │       (internal only — not exposed to internet)              │   │
│  │                          ▲               ▲                   │   │
│  │                          └───────────────┘                   │   │
│  │                                 │                            │   │
│  │                          ┌──────────┐                        │   │
│  │                          │  Caddy   │                        │   │
│  │                          │ :80/:443 │                        │   │
│  │                          └──────────┘                        │   │
│  └──────────────────────────────┬─────────────────────────────-─┘   │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
              yourdomain.com             api.yourdomain.com
              (Next.js web)              (NestJS API)
```

---

## 2. Why Each Service Exists

### Caddy — Reverse Proxy & TLS
**Responsibility:** The only publicly exposed service. Sits in front of everything, terminates TLS, and routes traffic to the right container.

- Automatically provisions and renews Let's Encrypt certificates (no manual SSL config).
- Routes `yourdomain.com` → Next.js web on port 3000.
- Routes `api.yourdomain.com` → NestJS API on port 3001.
- Adds security headers (`X-Frame-Options`, `X-Content-Type-Options`, removes `Server` header).
- Postgres, Redis, API, and Web are **never exposed directly to the internet** — only Caddy is.

### PostgreSQL + pgvector — Primary Database
**Responsibility:** Single source of truth for all persistent data.

- Stores: portfolio content, chat sessions, analytics events, knowledge base documents, WebAuthn credentials, embeddings.
- `pgvector` extension adds a vector column type (`vector(1536)`) enabling semantic similarity search directly in Postgres — no separate vector database needed.
- One Postgres instance. Multiple databases for multiple projects (one DB per project).

### Redis — Cache, Rate Limiting & Real-Time
**Responsibility:** Fast in-memory layer for everything that doesn't need to be in Postgres.

Used for:
- **Answer cache** — LLM responses cached by query hash, 1-hour TTL.
- **Rate limiting** — sliding window counters (per-IP, per-session) using Redis sorted sets.
- **Spend tracking** — daily LLM cost accumulator using `INCRBYFLOAT`, 48-hour TTL.
- **IP blocklist** — `SISMEMBER blocklist` check before any rate limit logic.
- **WebAuthn challenge storage** — temporary challenge store with 5-minute TTL.

### NestJS API — Backend
**Responsibility:** All business logic, data access, AI pipeline, and WebSockets. The main engineering showpiece.

- Clean architecture: `domain → application → infrastructure → presentation`.
- Exposes REST API at `/api/*` + SSE streaming at `/chat/stream` + WebSocket (Socket.IO).
- RAG chatbot pipeline: query → intent filter → embedding → pgvector search → LLM → stream.
- Admin endpoints protected by `JwtAuthGuard`. All data mutations go through this service.

### Next.js Web — Frontend
**Responsibility:** Server-rendered public portfolio site and admin dashboard.

- App Router with ISR (Incremental Static Regeneration) — pages are pre-built at deploy time and revalidated on-demand when admin publishes changes.
- Runs as a **standalone Node.js server** (not a static export) to support ISR and Server Components.
- `NEXT_PUBLIC_*` variables are **baked into the JavaScript bundle at Docker build time** — they cannot be changed at runtime without rebuilding the image.

### GitHub Actions — CI/CD
**Responsibility:** Automated testing, building, and deploying. The VPS never builds code.

- Three workflows: `ci.yml` (lint + type check), `pr.yml` (full test gate for PRs), `deploy.yml` (build images + push to GHCR + deploy to VPS).
- Images are built on GitHub's machines and stored in GHCR. The VPS just pulls pre-built images.

### Ansible — VPS Provisioning
**Responsibility:** One-time idempotent setup of a fresh Ubuntu VPS. Run it once, never touch the server manually.

- Installs Docker CE and Docker Compose plugin.
- Creates a `deploy` Linux user (member of `docker` group) for CI/CD to SSH into.
- Configures UFW firewall: deny all incoming except SSH (22), HTTP (80), HTTPS (443/tcp+udp).
- Configures fail2ban: 5 failed SSH attempts → 1-hour IP ban.
- Disables root password login and password authentication (key-only SSH).

### GitHub Container Registry (GHCR) — Image Registry
**Responsibility:** Stores versioned Docker images between GitHub Actions and the VPS.

- Each deploy creates two tags: `:latest` and `:<commit-sha>`.
- VPS pulls `:latest` at deploy time — always gets the most recent build.
- `:<commit-sha>` tags allow rollback to any previous build.

---

## 3. Full Deployment Flow Diagram

```
Developer                GitHub                        VPS
────────                 ──────                        ───
    │                       │                            │
    │  git push main        │                            │
    │──────────────────────▶│                            │
    │                       │                            │
    │              ┌────────┴─────────┐                  │
    │              │  ci.yml triggers │                  │
    │              │                  │                  │
    │              │  1. pnpm install │                  │
    │              │  2. turbo lint   │                  │
    │              │  3. turbo        │                  │
    │              │     type-check   │                  │
    │              │  4. turbo build  │                  │
    │              └────────┬─────────┘                  │
    │                       │ pass                       │
    │              ┌────────┴──────────────────┐         │
    │              │  deploy.yml triggers       │         │
    │              │                            │         │
    │              │  Job 1: Build images       │         │
    │              │  ┌─────────────────────┐  │         │
    │              │  │ docker buildx build  │  │         │
    │              │  │ services/api/        │  │         │
    │              │  │ Dockerfile           │  │         │
    │              │  │                      │  │         │
    │              │  │ Multi-stage build:   │  │         │
    │              │  │  base (node:alpine)  │  │         │
    │              │  │  → deps (pnpm i)     │  │         │
    │              │  │  → builder (compile) │  │         │
    │              │  │  → runner (prod img) │  │         │
    │              │  └──────────┬──────────┘  │         │
    │              │             │ push         │         │
    │              │             ▼              │         │
    │              │  ghcr.io/{owner}/          │         │
    │              │    portfolio-api:latest    │         │
    │              │    portfolio-api:{sha}     │         │
    │              │                            │         │
    │              │  ┌─────────────────────┐  │         │
    │              │  │ docker buildx build  │  │         │
    │              │  │ apps/web/Dockerfile  │  │         │
    │              │  │                      │  │         │
    │              │  │ Build args baked in: │  │         │
    │              │  │  NEXT_PUBLIC_API_URL │  │         │
    │              │  │  NEXT_PUBLIC_SITE_URL│  │         │
    │              │  └──────────┬──────────┘  │         │
    │              │             │ push         │         │
    │              │             ▼              │         │
    │              │  ghcr.io/{owner}/          │         │
    │              │    portfolio-web:latest    │         │
    │              │    portfolio-web:{sha}     │         │
    │              └────────────┬───────────────┘         │
    │                           │                         │
    │                           │  Job 2: Deploy          │
    │                           │  (SSH as deploy user)   │
    │                           │─────────────────────────▶
    │                           │                         │
    │                           │                cd /opt/portfolio
    │                           │                         │
    │                           │                docker compose
    │                           │                  -f docker-compose.prod.yml
    │                           │                  pull
    │                           │                  (fetches :latest from GHCR)
    │                           │                         │
    │                           │                docker compose
    │                           │                  -f docker-compose.prod.yml
    │                           │                  up -d --remove-orphans
    │                           │                  (restarts api + web)
    │                           │                  (postgres+redis already up)
    │                           │                         │
    │                           │                docker image prune -f
    │                           │                         │
    │                     ✅ Deploy complete               │
```

---

## 4. Phase 1 — One-Time VPS Setup (Ansible)

Run this **once** when you provision a new VPS. It is idempotent — safe to re-run.

### Prerequisites

- Ansible installed on your local machine (`pip install ansible`)
- SSH access to the VPS as `root`
- An SSH key pair for the `deploy` user (used by GitHub Actions later)

```bash
# Generate a dedicated SSH key for GitHub Actions deploys
ssh-keygen -t ed25519 -f ~/.ssh/deploy_id_ed25519 -C "github-actions-deploy"
```

### Configure inventory

```bash
cp ansible/inventory.example.yml ansible/inventory.yml
```

Edit `ansible/inventory.yml`:
```yaml
all:
  hosts:
    vps:
      ansible_host: YOUR_VPS_IP        # e.g. 123.456.789.10
      ansible_user: root
      ansible_ssh_private_key_file: ~/.ssh/id_ed25519   # your root SSH key
```

### Run the playbook

```bash
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml \
  --extra-vars "deploy_ssh_public_key='$(cat ~/.ssh/deploy_id_ed25519.pub)'"
```

### What it does (in order)

| Step | Action |
|---|---|
| 1 | `apt update && apt upgrade` — patches the OS |
| 2 | Installs: `curl`, `git`, `wget`, `ufw`, `fail2ban`, `ca-certificates` |
| 3 | Adds Docker's official apt repo and installs Docker CE + Compose plugin |
| 4 | Creates `deploy` Linux user, adds to `docker` group |
| 5 | Installs your GitHub Actions SSH public key into `deploy`'s `authorized_keys` |
| 6 | Creates `/opt/portfolio` directory, copies `docker-compose.prod.yml` and `Caddyfile` |
| 7 | Configures UFW: deny all in, allow out, open 22/80/443 |
| 8 | Configures fail2ban: ban IP for 1 hour after 5 failed SSH attempts |
| 9 | Disables root password login and password authentication in sshd |

### After Ansible — manual step

Ansible cannot securely copy your secrets. You must SCP the production env file to the server yourself:

```bash
# Create .env from the template, fill in all values
cp .env.prod.example .env.prod
# ... edit .env.prod with real values ...

# Copy it to the server
scp .env.prod deploy@YOUR_VPS_IP:/opt/portfolio/.env
```

> **The `.env` file must exist at `/opt/portfolio/.env` before the first deploy runs.**

---

## 5. Phase 2 — CI Pipeline (GitHub Actions)

**File:** `.github/workflows/ci.yml`  
**Triggers:** Every push to `main` and every PR targeting `main`

This is the fast quality gate. It runs on GitHub's machines — nothing touches the VPS.

```
push to main / PR opened
        │
        ▼
┌─────────────────────────┐
│  Job 1: Lint & Typecheck│
│  ─────────────────────  │
│  pnpm install           │
│  turbo run lint         │
│  turbo run type-check   │
└────────────┬────────────┘
             │ must pass
             ▼
┌─────────────────────────┐
│  Job 2: Build           │
│  ─────────────────────  │
│  pnpm install           │
│  turbo run build        │
│  (verifies no compile   │
│   errors in all pkgs)   │
└─────────────────────────┘
```

### PR-specific gate

**File:** `.github/workflows/pr.yml`  
**Triggers:** PRs to `main` only

Runs a full test suite in parallel. All jobs must pass before a PR can be merged:

| Job | What it does |
|---|---|
| Unit tests | `pnpm --filter api test` + `pnpm --filter web test` with coverage |
| Integration tests | Uses Testcontainers (real Postgres + Redis containers) |
| Type check | `pnpm turbo type-check` across all packages |
| Lint | `pnpm turbo lint` |
| E2E tests | Playwright browser tests against mocked API |
| Gate | Blocks merge until all above pass |

---

## 6. Phase 3 — Build & Deploy Pipeline (GitHub Actions)

**File:** `.github/workflows/deploy.yml`  
**Triggers:** Push to `main` or manual `workflow_dispatch`

Two sequential jobs. The VPS never compiles code — it only runs pre-built images.

### Job 1: Build images

Runs on GitHub's Ubuntu runners with Docker Buildx:

**API image** — built from `services/api/Dockerfile`
```
base (node:22-alpine + python3 + pnpm)
  └── deps  (pnpm install --frozen-lockfile)
        └── builder  (prisma generate + pnpm build → dist/)
              └── runner  (production: dist/ + node_modules + prisma/)
                          CMD: prisma migrate deploy && node dist/main
```

**Web image** — built from `apps/web/Dockerfile`
```
base (node:22-alpine + python3 + pnpm)
  └── deps  (pnpm install --frozen-lockfile)
        └── builder  (pnpm build → .next/standalone)
              │       ← NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SITE_URL
              │         are baked into the JS bundle here
              └── runner  (production: .next/standalone server)
                          CMD: node apps/web/server.js
```

Both images are pushed to GHCR with two tags:
- `:latest` — what the VPS always pulls
- `:<commit-sha>` — kept for rollback (e.g. `portfolio-api:abc1234`)

> **Important:** `NEXT_PUBLIC_*` environment variables are compiled into the JavaScript bundle during the Docker build. Changing them later requires a new image build. They are read from GitHub Actions secrets at build time.

### Job 2: Deploy to VPS

Runs after Job 1 succeeds. Uses `appleboy/ssh-action` to SSH into the VPS as the `deploy` user:

```bash
cd /opt/portfolio
docker compose -f docker-compose.prod.yml pull        # fetch new :latest images
docker compose -f docker-compose.prod.yml up -d --remove-orphans  # restart containers
docker image prune -f                                  # clean dangling layers
```

Postgres and Redis are already running and healthy — they are skipped by `up -d` (no changes). Only `api` and `web` containers restart with the new images.

### GitHub Secrets required

Set these in: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|---|---|
| `VPS_HOST` | Your VPS IP address |
| `VPS_SSH_KEY` | Contents of `~/.ssh/deploy_id_ed25519` (private key) |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` |

---

## 7. Phase 4 — Runtime on VPS (Docker Compose)

**File:** `docker-compose.prod.yml`

Five containers on a single internal Docker bridge network (`internal`). Only Caddy has public ports.

```
Internet
   │
   │ :80 (HTTP → redirected to HTTPS)
   │ :443 (HTTPS)
   │ :443/udp (HTTP/3 / QUIC)
   ▼
┌──────────────────────────────────────────┐
│             Caddy container              │
│                                          │
│  {$DOMAIN}     → reverse_proxy web:3000  │
│  {$API_DOMAIN} → reverse_proxy api:3001  │
│                                          │
│  Auto TLS via Let's Encrypt              │
│  Gzip compression                        │
│  Security headers                        │
└──────────────┬──────────────┬────────────┘
               │              │
       internal network   internal network
               │              │
               ▼              ▼
    ┌───────────────┐  ┌─────────────┐
    │  Next.js Web  │  │  NestJS API │
    │   :3000       │  │   :3001     │
    └───────────────┘  └──────┬──────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
           ┌─────────────┐     ┌──────────────┐
           │  PostgreSQL  │     │    Redis     │
           │  + pgvector  │     │  7-alpine    │
           │   :5432      │     │   :6379      │
           └─────────────┘     └──────────────┘
```

### Container responsibilities at runtime

| Container | Image | Starts when |
|---|---|---|
| `postgres` | `pgvector/pgvector:pg17` | Always |
| `redis` | `redis:7-alpine` | Always |
| `api` | `ghcr.io/{owner}/portfolio-api:latest` | After postgres + redis healthy |
| `web` | `ghcr.io/{owner}/portfolio-web:latest` | After api healthy |
| `caddy` | `caddy:2-alpine` | After web + api healthy |

### Health checks

Each container has a health check. Docker waits for `healthy` status before starting the next container in the dependency chain. This prevents the API from starting before Postgres is ready.

---

## 8. Local Development Setup

Use this for day-to-day development. Runs the app natively (no Docker overhead for app code), only infra services in Docker.

### Prerequisites

- Node.js 22
- pnpm 11 (`npm install -g pnpm@11`)
- Docker Desktop

### Steps

```bash
# 1. Clone and install dependencies
git clone https://github.com/{owner}/portfolio.git
cd portfolio
pnpm install

# 2. Start infrastructure (Postgres + Redis only)
docker compose up postgres redis -d

# 3. Copy env file and fill in values
cp .env.example .env
# Edit .env — add OPENROUTER_API_KEY, ELEVENLABS keys, etc.

# 4. Run database migrations and generate Prisma client
cd services/api
pnpm run db:migrate
pnpm run db:generate
cd ../..

# 5. Start API (terminal 1)
pnpm --filter api run start:dev

# 6. Start web (terminal 2)
pnpm --filter web run dev
```

| Service | URL |
|---|---|
| Public site | http://localhost:3000 |
| Admin dashboard | http://localhost:3000/admin |
| NestJS API | http://localhost:3001 |
| Swagger docs | http://localhost:3001/api/docs |
| Adminer (DB UI) | http://localhost:8080 |

---

## 9. Simulating Production Locally

Use this to verify the full Docker stack works before deploying to the VPS.

### Step 1 — Build images locally (simulates GitHub Actions build)

```powershell
# From project root
docker build `
  -t ghcr.io/hammadafzalcode/portfolio-api:latest `
  -f services/api/Dockerfile .

docker build `
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 `
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 `
  -t ghcr.io/hammadafzalcode/portfolio-web:latest `
  -f apps/web/Dockerfile .
```

### Step 2 — Create a local Caddyfile (HTTP only — no ACME on localhost)

Create `Caddyfile.local`:
```
{
  auto_https off
}

:80 {
  reverse_proxy web:3000
  encode gzip
}

:8081 {
  reverse_proxy api:3001
  encode gzip
}
```

### Step 3 — Create a compose override for local

Create `docker-compose.local-prod.override.yml`:
```yaml
services:
  caddy:
    volumes:
      - ./Caddyfile.local:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
```

### Step 4 — Create local prod env file

```bash
cp .env.prod.example .env.local-prod
# Edit .env.local-prod:
#   GITHUB_REPOSITORY_OWNER=hammadafzalcode
#   DOMAIN=localhost
#   API_DOMAIN=localhost
#   CADDY_EMAIL=test@test.com
#   POSTGRES_USER=portfolio
#   POSTGRES_PASSWORD=portfolio
#   POSTGRES_DB=portfolio
#   JWT_SECRET=super-secret-jwt-key-change-in-prod
#   ... fill rest from .env
```

### Step 5 — Run the prod stack

```powershell
docker compose `
  -f docker-compose.prod.yml `
  -f docker-compose.local-prod.override.yml `
  --env-file .env.local-prod `
  up -d
```

### Step 6 — Verify

```bash
curl http://localhost:80          # web (should return HTML)
curl http://localhost:8081/health # API (should return {"ok":true})
```

---

## 10. Environment Variables Reference

### Variables that live on the VPS only (`/opt/portfolio/.env`)

| Variable | Example | Notes |
|---|---|---|
| `GITHUB_REPOSITORY_OWNER` | `hammadafzalcode` | Resolves GHCR image names |
| `DOMAIN` | `yourdomain.com` | Public site domain for Caddy |
| `API_DOMAIN` | `api.yourdomain.com` | API domain for Caddy |
| `CADDY_EMAIL` | `you@example.com` | Let's Encrypt registration |
| `POSTGRES_USER` | `portfolio` | DB credentials |
| `POSTGRES_PASSWORD` | `strong-random-pw` | Generate: `openssl rand -base64 24` |
| `POSTGRES_DB` | `portfolio` | Database name |
| `JWT_SECRET` | `<random>` | Generate: `openssl rand -base64 48` |
| `REVALIDATE_SECRET` | `<random>` | Shared between API and web for ISR |
| `ADMIN_EMAIL` | `you@example.com` | Admin login email |
| `ADMIN_PASSWORD_HASH` | `$2a$12$...` | `node -e "require('bcrypt').hash('pw',12).then(console.log)"` |
| `ALLOWED_ORIGINS` | `https://yourdomain.com` | CORS allowlist for API |
| `RP_ID` | `yourdomain.com` | WebAuthn relying party domain |
| `RP_ORIGIN` | `https://yourdomain.com` | WebAuthn full origin |
| `DEEPSEEK_API_KEY` | `sk-...` | LLM provider |
| `OPENAI_API_KEY` | `sk-...` | Embeddings (ada-002) |
| `GITHUB_TOKEN` | `ghp_...` | Read-only PAT for GitHub API |
| `GITHUB_USERNAME` | `HammadAfzalCode` | GitHub profile to pull |

### Variables that live in GitHub Secrets (baked into images at build)

| Secret | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` — compiled into JS bundle |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` — compiled into JS bundle |
| `VPS_HOST` | IP address of the VPS |
| `VPS_SSH_KEY` | Contents of `~/.ssh/deploy_id_ed25519` private key |

> **Why are NEXT_PUBLIC_* in GitHub Secrets instead of the `.env` on the VPS?**  
> Next.js bakes these values into the JavaScript bundle at compile time. They must be available during the Docker build (which runs on GitHub Actions), not at container startup. The `.env` on the VPS is read at container startup — too late for these vars.

---

## 11. Multi-Project VPS Setup

When hosting multiple projects on the same VPS, share the infra layer:

### Architecture

```
VPS 20 (6 vCPU / 12 GB RAM)
│
├── [shared-infra network]
│   ├── PostgreSQL  ← one database per project
│   ├── Redis       ← one key prefix per project
│   └── Caddy       ← routes all domains
│
├── [project-1 network] ← connects to shared-infra
│   ├── NestJS API  (~200 MB)
│   └── Next.js Web (~250 MB)
│
├── [project-2 network] ← connects to shared-infra
│   ├── NestJS API  (~200 MB)
│   └── Next.js Web (~250 MB)
│
└── ... (comfortable up to 6–8 similar stacks)
```

### Capacity estimate on VPS 20

| Resource | Total | Shared infra | Per project | Max projects |
|---|---|---|---|---|
| RAM | 12 GB | ~1 GB | ~450 MB | ~8–10 comfortable |
| NVMe | 100 GB | ~8 GB | ~1.5 GB | ~60 (storage limit) |
| vCPU | 6 | idle mostly | idle mostly | CPU is not the bottleneck |

Storage is usually the first constraint. Contabo offers NVMe extensions.

### Multi-project database isolation

Each project gets its own Postgres database, not its own Postgres server:

```sql
-- On the shared Postgres container
CREATE DATABASE project2_db;
CREATE USER project2 WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE project2_db TO project2;
```

Each project's `DATABASE_URL` points to the same host but different database:
```
postgresql://project2:password@postgres:5432/project2_db
```

---

## 12. Maintenance & Operations

### Rollback to a previous deploy

Every deploy pushes a `:<commit-sha>` tag to GHCR. To rollback:

```bash
# On the VPS, as deploy user
cd /opt/portfolio

# Edit docker-compose.prod.yml temporarily to pin to a specific sha
# api: ghcr.io/hammadafzalcode/portfolio-api:abc1234
# web: ghcr.io/hammadafzalcode/portfolio-web:abc1234

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### View logs

```bash
# All containers
docker compose -f docker-compose.prod.yml logs -f

# Specific container
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

### Database backup

```bash
# Manual snapshot
docker exec portfolio_postgres pg_dump -U portfolio portfolio > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i portfolio_postgres psql -U portfolio portfolio < backup_20260101.sql
```

### Updating Caddy config or docker-compose.prod.yml

These files live at `/opt/portfolio/` on the VPS. To update them:

```bash
# From local machine
scp docker-compose.prod.yml deploy@YOUR_VPS_IP:/opt/portfolio/docker-compose.prod.yml
scp Caddyfile deploy@YOUR_VPS_IP:/opt/portfolio/Caddyfile

# Caddy reloads config automatically when the file changes
# For compose changes, run:
docker compose -f docker-compose.prod.yml up -d
```

### Check container health

```bash
docker compose -f docker-compose.prod.yml ps
```

All containers should show `healthy`. If any shows `unhealthy`, check its logs.

### Free disk space

```bash
# Remove unused images
docker image prune -f

# Remove everything unused (careful — removes stopped containers too)
docker system prune -f
```
