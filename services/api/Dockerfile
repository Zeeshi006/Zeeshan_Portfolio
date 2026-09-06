# ── Stage 1: Install dependencies ────────────────────────────────────────────
# Separate layer so Docker cache survives source-only changes.
FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .

RUN pnpm --filter @portfolio/api exec prisma generate
RUN pnpm --filter @portfolio/api build

# pnpm deploy creates a clean dir with only production deps,
# correctly resolving workspace packages (@portfolio/types etc.)
RUN pnpm --filter @portfolio/api deploy --prod --legacy /deploy

# Regenerate Prisma client inside /deploy so the engine binary lands in the right place.
COPY services/api/prisma /deploy/prisma
RUN cd /deploy && node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
# Use node:22-slim (Debian-based) not Alpine — Prisma ships glibc binaries
# from GitHub Actions runners; musl (Alpine) would need a separate binary target.
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/services/api/dist ./dist
# prisma/ is needed for `prisma migrate deploy` run during deployment
COPY --from=builder --chown=nestjs:nodejs /repo/services/api/prisma ./prisma

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
