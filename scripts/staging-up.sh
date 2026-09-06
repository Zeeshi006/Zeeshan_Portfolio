#!/usr/bin/env bash
# staging-up.sh
# Builds and starts the full staging environment (API + Web + Postgres + Redis).
# Runs migrations automatically before starting the API.
#
# Usage:
#   ./scripts/staging-up.sh          — full boot
#   ./scripts/staging-up.sh api      — rebuild + restart API only
#   ./scripts/staging-up.sh down     — stop and remove staging containers

set -euo pipefail

COMPOSE="docker-compose.staging.yml"
ENV_FILE=".env.staging"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env.staging not found."
  echo "    Copy .env.staging.example → .env.staging and fill in the values."
  exit 1
fi

case "${1:-up}" in

  up)
    echo "▶  Building staging images..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" build

    echo "▶  Starting postgres + redis..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d postgres redis

    echo "▶  Waiting for postgres..."
    until docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
      exec -T postgres pg_isready -U portfolio > /dev/null 2>&1; do
      sleep 1
    done

    echo "▶  Running migrations..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
      run --rm --no-deps api node_modules/.bin/prisma migrate deploy

    echo "▶  Starting API + Web..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d

    echo ""
    echo "✔  Staging is live:"
    echo "   Web → http://localhost:3000"
    echo "   API → http://localhost:3001"
    echo "   Swagger → http://localhost:3001/api/docs"
    echo ""
    echo "   Logs: docker compose -f docker-compose.staging.yml logs -f api"
    ;;

  api)
    echo "▶  Rebuilding API only..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" build api
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d api
    echo "✔  API restarted. Logs:"
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs api --tail=30
    ;;

  down)
    echo "▶  Stopping staging environment..."
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" down
    echo "✔  Staging stopped. Data volume preserved."
    echo "   To also delete the DB volume: docker volume rm portfolio_staging_postgres_data"
    ;;

  *)
    echo "Usage: ./scripts/staging-up.sh [up|api|down]"
    exit 1
    ;;
esac
