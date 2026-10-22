#!/usr/bin/env bash
# Back up the database and uploaded files as a matched timestamped pair.
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"
DEST="${BACKUP_DIR:-$KIT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "RETENTION_DAYS must be an integer." >&2; exit 1; }

mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%d_%H%M%S)
DB_OUT="$DEST/amis-${STAMP}.sql.gz"
UPLOADS_OUT="$DEST/amis-${STAMP}-uploads.tar.gz"
DB_TMP="$DEST/.amis-${STAMP}.sql.gz.tmp"
UPLOADS_TMP="$DEST/.amis-${STAMP}-uploads.tar.gz.tmp"
trap 'rm -f "$DB_TMP" "$UPLOADS_TMP"' EXIT

echo "[$(date)] Backing up database and uploads with stamp $STAMP"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db \
    sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$DB_TMP"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T api \
    tar -czf - -C /app/apps/api/uploads . > "$UPLOADS_TMP"

gzip -t "$DB_TMP"
tar -tzf "$UPLOADS_TMP" >/dev/null
mv "$DB_TMP" "$DB_OUT"
mv "$UPLOADS_TMP" "$UPLOADS_OUT"

DB_SIZE=$(stat -c%s "$DB_OUT")
UPLOADS_SIZE=$(stat -c%s "$UPLOADS_OUT")
echo "[$(date)] Database backup: $DB_OUT ($DB_SIZE bytes)"
echo "[$(date)] Uploads backup: $UPLOADS_OUT ($UPLOADS_SIZE bytes)"

find "$DEST" -type f \( -name 'amis-*.sql.gz' -o -name 'amis-*-uploads.tar.gz' \) \
    -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Pruned backups older than ${RETENTION_DAYS} days."
