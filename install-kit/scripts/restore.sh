#!/usr/bin/env bash
# Restore a matched AMIS database and uploads backup pair.
# Usage: ./scripts/restore.sh backups/amis-<stamp>.sql.gz backups/amis-<stamp>-uploads.tar.gz
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <database-backup.sql.gz> <uploads-backup.tar.gz>" >&2
  exit 1
fi
DB_DUMP="$1"
UPLOADS_DUMP="$2"
[[ -f "$DB_DUMP" ]] || { echo "File not found: $DB_DUMP" >&2; exit 1; }
[[ -f "$UPLOADS_DUMP" ]] || { echo "File not found: $UPLOADS_DUMP" >&2; exit 1; }
gzip -t "$DB_DUMP"
tar -tzf "$UPLOADS_DUMP" >/dev/null

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"

read -r -p "This will OVERWRITE the database and uploaded files. Type 'RESTORE' to continue: " ans
[[ "$ans" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

echo "[1/4] Stopping API/Web..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" stop api web

echo "[2/4] Recreating database..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db sh -c \
    'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"'

echo "[3/4] Restoring database..."
gunzip -c "$DB_DUMP" | docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "[4/4] Restoring uploaded files..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" run --rm --no-deps -T \
    --entrypoint sh api -c \
    'find /app/apps/api/uploads -mindepth 1 -delete && tar -xzf - -C /app/apps/api/uploads' \
    < "$UPLOADS_DUMP"

echo "Starting services..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d api web

echo "Restore completed. Run ./scripts/healthcheck.sh before returning AMIS to service."
