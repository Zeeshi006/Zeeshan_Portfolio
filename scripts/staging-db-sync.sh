#!/usr/bin/env bash
# staging-db-sync.sh
# Dumps the production Postgres database and restores it into the local staging container.
# Run this whenever you want fresh prod data in staging.
#
# Usage: ./scripts/staging-db-sync.sh
# Prerequisites:
#   - SSH access to VPS configured (ssh root@vmi3545493 works without password prompt)
#   - .env.staging exists in repo root
#   - staging postgres container is running (docker compose -f docker-compose.staging.yml up -d postgres)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
VPS_HOST="vmi3545493"
VPS_USER="root"
VPS_COMPOSE="/opt/portfolio/docker-compose.prod.yml"
DUMP_FILE="/tmp/portfolio_staging_dump.sql"
LOCAL_COMPOSE="docker-compose.staging.yml"
ENV_FILE=".env.staging"

# ── Load local staging env ────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env.staging not found. Copy .env.staging.example and fill in the values."
  exit 1
fi

set -a && source "$ENV_FILE" && set +a

LOCAL_DB_USER="${POSTGRES_USER:-portfolio}"
LOCAL_DB_PASS="${POSTGRES_PASSWORD:-portfolio}"
LOCAL_DB_NAME="${POSTGRES_DB:-portfolio}"

echo "▶  Dumping production database..."
ssh "${VPS_USER}@${VPS_HOST}" \
  "docker compose -f ${VPS_COMPOSE} exec -T postgres \
    pg_dump -U portfolio -d portfolio --no-owner --no-acl -F p" \
  > "$DUMP_FILE"

echo "✔  Dump saved to ${DUMP_FILE} ($(du -sh "$DUMP_FILE" | cut -f1))"

echo "▶  Ensuring staging postgres is running..."
docker compose -f "$LOCAL_COMPOSE" --env-file "$ENV_FILE" up -d postgres

echo "▶  Waiting for staging postgres to be ready..."
until docker compose -f "$LOCAL_COMPOSE" --env-file "$ENV_FILE" \
  exec -T postgres pg_isready -U "$LOCAL_DB_USER" > /dev/null 2>&1; do
  sleep 1
done

echo "▶  Dropping and recreating staging database..."
docker compose -f "$LOCAL_COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -c "DROP DATABASE IF EXISTS \"${LOCAL_DB_NAME}\";" postgres
docker compose -f "$LOCAL_COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -c "CREATE DATABASE \"${LOCAL_DB_NAME}\";" postgres

echo "▶  Restoring dump into staging database..."
docker compose -f "$LOCAL_COMPOSE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" < "$DUMP_FILE"

echo "✔  Staging database synced from production."
echo "   You can now run: ./scripts/staging-up.sh"
