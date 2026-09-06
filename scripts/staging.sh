#!/usr/bin/env bash
# staging.sh — one command to rule them all
# Syncs prod DB, builds images, runs migrations, boots staging.
# Usage: pnpm staging  (or npm run staging)

set -euo pipefail

COMPOSE="docker-compose.staging.yml"
ENV_FILE=".env.staging"
VPS_HOST="vmi3545493.contaboserver.net"
VPS_USER="root"
VPS_COMPOSE="/opt/portfolio/docker-compose.prod.yml"
DUMP_FILE="/tmp/portfolio_staging_dump.sql"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}▶  $1${NC}"; }
ok()    { echo -e "${GREEN}✔  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $1${NC}"; }
die()   { echo -e "${RED}❌  $1${NC}"; exit 1; }

# ── Preflight ─────────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || die ".env.staging not found. Copy .env.staging.example → .env.staging and fill in values."
command -v docker &>/dev/null || die "Docker is not running."

set -a && source <(grep -v '^#' "$ENV_FILE" | grep -v '^$') && set +a

LOCAL_DB_USER="${POSTGRES_USER:-portfolio}"
LOCAL_DB_NAME="${POSTGRES_DB:-portfolio}"

# ── 1. Sync prod DB ───────────────────────────────────────────────────────────
step "Dumping production database via SSH..."
ssh "${VPS_USER}@${VPS_HOST}" \
  "docker compose -f ${VPS_COMPOSE} exec -T postgres \
    pg_dump -U portfolio -d portfolio --no-owner --no-acl -F p" \
  > "$DUMP_FILE"
ok "Dump complete ($(du -sh "$DUMP_FILE" | cut -f1))"

# ── 2. Start postgres + redis ─────────────────────────────────────────────────
step "Starting postgres + redis..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d postgres redis

step "Waiting for postgres to be ready..."
until docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
  exec -T postgres pg_isready -U "$LOCAL_DB_USER" > /dev/null 2>&1; do
  sleep 1
done
ok "Postgres ready"

# ── 3. Restore DB ─────────────────────────────────────────────────────────────
step "Restoring prod data into staging DB..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -c "DROP DATABASE IF EXISTS \"${LOCAL_DB_NAME}\";" postgres
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -c "CREATE DATABASE \"${LOCAL_DB_NAME}\";" postgres
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" < "$DUMP_FILE"
ok "Database restored"

# ── 4. Build images ───────────────────────────────────────────────────────────
step "Building API + Web images from local source..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" build
ok "Build complete"

# ── 5. Run migrations ─────────────────────────────────────────────────────────
step "Running database migrations..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
  run --rm --no-deps api node_modules/.bin/prisma migrate deploy
ok "Migrations applied"

# ── 6. Start everything ───────────────────────────────────────────────────────
step "Starting all services..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d
ok "Staging is live"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Staging ready${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Web     → ${CYAN}http://localhost:3000${NC}"
echo -e "  API     → ${CYAN}http://localhost:3001${NC}"
echo -e "  Swagger → ${CYAN}http://localhost:3001/api/docs${NC}"
echo ""
echo -e "  Logs:  ${YELLOW}docker compose -f docker-compose.staging.yml logs -f api${NC}"
echo -e "  Stop:  ${YELLOW}docker compose -f docker-compose.staging.yml down${NC}"
echo ""
