#!/usr/bin/env bash
# Restore the AMIS database from a gzipped pg_dump.
# Usage:  ./scripts/restore.sh backups/amis-2026-05-21_0100.sql.gz
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi
DUMP="$1"
[[ -f "$DUMP" ]] || { echo "File not found: $DUMP" >&2; exit 1; }

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"

read -r -p "This will OVERWRITE the current database. Type 'RESTORE' to continue: " ans
[[ "$ans" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

echo "[1/4] Stopping API/Web..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" stop api web

echo "[2/4] Dropping & recreating database..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db \
    psql -U amis -d postgres -c "DROP DATABASE IF EXISTS amis;"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db \
    psql -U amis -d postgres -c "CREATE DATABASE amis OWNER amis;"

echo "[3/4] Restoring from $DUMP ..."
gunzip -c "$DUMP" | docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db psql -U amis amis

echo "[4/4] Restarting services..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" start api web

echo "Done."
