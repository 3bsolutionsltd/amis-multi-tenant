#!/usr/bin/env bash
# Nightly database backup. Run from cron at 01:00.
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"
DEST="${BACKUP_DIR:-$KIT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%d_%H%M)
OUT="$DEST/amis-${STAMP}.sql.gz"

echo "[$(date)] Backing up to $OUT"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db \
    pg_dump -U "${POSTGRES_USER:-amis}" "${POSTGRES_DB:-amis}" | gzip > "$OUT"

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "[$(date)] OK ($SIZE bytes)"

# Retention
find "$DEST" -type f -name 'amis-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Pruned backups older than ${RETENTION_DAYS} days."
