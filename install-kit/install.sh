#!/usr/bin/env bash
# AMIS one-command installer (Linux / macOS)
# Usage:  sudo ./install.sh
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$KIT_DIR/config/docker-compose.offline.yml"
ENV_FILE="$KIT_DIR/config/.env.offline"
ENV_TEMPLATE="$KIT_DIR/config/.env.offline.example"

cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
warn()  { printf '\033[33m%s\033[0m\n' "$*"; }

cyan "============================================="
cyan "  AMIS Offline Installer"
cyan "============================================="
echo

# ── 1. Pre-flight ────────────────────────────────────────────────
cyan "[1/6] Checking prerequisites..."
if ! command -v docker >/dev/null 2>&1; then
  red "Docker is not installed. Install Docker Engine first."
  red "See: docs/03-requirements.md"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  red "Docker Compose plugin missing. Install docker-compose-plugin."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  red "Cannot talk to the Docker daemon. Is it running? Are you in the docker group?"
  exit 1
fi
green "  Docker OK ($(docker --version))"

# ── 2. Load images ───────────────────────────────────────────────
cyan "[2/6] Loading Docker images from images/..."
for tar in postgres.tar amis-api.tar amis-web.tar dbmate.tar; do
  if [[ ! -f "$KIT_DIR/images/$tar" ]]; then
    red "Missing $KIT_DIR/images/$tar — bundle incomplete. See MANIFEST.md."
    exit 1
  fi
  echo "  loading $tar..."
  docker load -i "$KIT_DIR/images/$tar" >/dev/null
done
green "  All images loaded."

# ── 3. Build / verify .env.offline ───────────────────────────────
cyan "[3/6] Configuring environment..."
if [[ -f "$ENV_FILE" ]]; then
  warn "  $ENV_FILE already exists — keeping it."
else
  read -r -p "  Server LAN IP (e.g. 192.168.1.100): " SERVER_IP
  if [[ -z "$SERVER_IP" ]]; then red "IP is required"; exit 1; fi

  PG_PW=$(openssl rand -base64 24 | tr -d '/+=$' | head -c 32)
  JWT=$(openssl rand -hex 64)

  cp "$ENV_TEMPLATE" "$ENV_FILE"
  sed -i.bak \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PW}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" \
    -e "s|^CORS_ORIGIN=.*|CORS_ORIGIN=http://${SERVER_IP}|" \
    -e "s|^VITE_API_URL=.*|VITE_API_URL=http://${SERVER_IP}:3001|" \
    "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  chmod 600 "$ENV_FILE"
  green "  Generated $ENV_FILE (mode 600). KEEP IT SAFE."
  warn  "  Postgres password (record this!): ${PG_PW}"
fi

# ── 4. Database + migrations ─────────────────────────────────────
cyan "[4/6] Starting database and applying migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db
sleep 8
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate

# ── 5. Start the stack ───────────────────────────────────────────
cyan "[5/6] Starting API and Web..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
sleep 5

# ── 6. Health check ──────────────────────────────────────────────
cyan "[6/6] Health check..."
if curl -fsS http://localhost:3001/health >/dev/null; then
  green "  API healthy."
else
  warn "  API not healthy yet — check 'docker compose logs api'"
fi

SERVER_IP_PRINT=$(grep '^CORS_ORIGIN=' "$ENV_FILE" | sed 's|CORS_ORIGIN=http://||')
echo
green "============================================="
green "  AMIS is installed!"
green "  Open this URL in any LAN browser:"
green "      http://${SERVER_IP_PRINT}"
green "============================================="
echo
echo "Next steps:"
echo "  - Log in with the platform-admin credentials supplied by 3B Solutions."
echo "  - Read docs/07-first-login.md."
echo "  - Schedule daily backups:  see docs/10-backup.md."
