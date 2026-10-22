#!/usr/bin/env bash
# AMIS one-command installer (Ubuntu Server)
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
  read -r -p "  Server LAN IP or hostname (e.g. 192.168.1.100): " SERVER_HOST
  if [[ ! "$SERVER_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
    red "Enter a valid IPv4 address or LAN hostname without a scheme or port."
    exit 1
  fi

  PG_PW=$(openssl rand -base64 24 | tr -d '/+=$' | head -c 32)
  JWT=$(openssl rand -hex 64)

  cp "$ENV_TEMPLATE" "$ENV_FILE"
  sed -i.bak \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PW}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" \
    -e "s|^CORS_ORIGIN=.*|CORS_ORIGIN=http://${SERVER_HOST}|" \
    "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  chmod 600 "$ENV_FILE"
  green "  Generated $ENV_FILE with private database and signing secrets (mode 600)."
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
healthy=false
for attempt in {1..30}; do
  if curl -fsS http://localhost:3001/health >/dev/null &&
    curl -fsS http://localhost/ >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ "$healthy" != true ]]; then
  red "Installation did not pass its health checks."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=100 api web
  exit 1
fi

SERVER_HOST_PRINT=$(grep '^CORS_ORIGIN=' "$ENV_FILE" | sed 's|CORS_ORIGIN=http://||')
echo
green "============================================="
green "  AMIS is installed!"
green "  Complete institute setup at:"
green "      http://${SERVER_HOST_PRINT}/setup"
green "============================================="
echo
echo "Next steps:"
echo "  - Create the institute and initial administrator at the setup URL."
echo "  - Read docs/07-first-login.md."
echo "  - Schedule daily backups:  see docs/10-backup.md."
