#!/usr/bin/env bash
# Capture diagnostics for support tickets.
# Output:  diag-YYYYmmdd-HHMM.txt in current directory.
set -uo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"

OUT="diag-$(date +%Y%m%d-%H%M).txt"
{
  echo "===== AMIS Diagnostics ($(date)) ====="
  echo
  echo "----- uname -----";          uname -a
  echo "----- docker -----";         docker --version
  docker compose version
  echo
  echo "----- compose ps -----";     docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps
  echo
  echo "----- images -----";         docker images | grep -E 'amis|postgres'
  echo
  echo "----- API logs (tail 500) -----"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs --tail 500 api
  echo
  echo "----- DB logs (tail 200) -----"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs --tail 200 db
  echo
  echo "----- Web logs (tail 100) -----"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs --tail 100 web
  echo
  echo "----- Disk -----";           df -h
  echo
  echo "----- Env (secrets redacted) -----"
  grep -v -E '^(POSTGRES_PASSWORD|JWT_SECRET)=' "$ENV_FILE" 2>/dev/null || echo "(no env file)"
} > "$OUT" 2>&1
echo "Wrote $OUT"
