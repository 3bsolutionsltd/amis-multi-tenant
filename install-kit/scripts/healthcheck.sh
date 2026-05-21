#!/usr/bin/env bash
# Quick health check.  Exit 0 if all containers up and API healthy, else 1.
set -uo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"

fail=0

echo "== Containers =="
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps || fail=1

echo
echo "== API /health =="
if curl -fsS http://localhost:3001/health; then
  echo " OK"
else
  echo " FAIL"; fail=1
fi

echo
echo "== Web :80 =="
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)
echo "  HTTP $code"
[[ "$code" == "200" ]] || fail=1

echo
echo "== Disk =="
df -h / | tail -n 1

exit $fail
