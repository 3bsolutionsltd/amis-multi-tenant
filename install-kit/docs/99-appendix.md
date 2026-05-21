# Appendix — Files & Ports Reference

## File reference

| Path (inside `install-kit/`) | Purpose |
|------------------------------|---------|
| `README.md` | Top-level "start here". |
| `QUICK-START.md` | Printable cheat-sheet. |
| `MANIFEST.md` | Vendor checklist before shipping the kit. |
| `install.sh` / `install.ps1` | One-command installer. |
| `config/docker-compose.offline.yml` | Container orchestration. |
| `config/.env.offline.example` | Env template. Copy to `.env.offline`. |
| `config/.env.offline` | Real env file (created by installer). **Mode 600. Never commit.** |
| `scripts/load-images.sh` / `.ps1` | Loads `images/*.tar` into Docker. |
| `scripts/backup.sh` | Nightly gzipped pg_dump. |
| `scripts/restore.sh` | Restores from a gzipped pg_dump. |
| `scripts/healthcheck.sh` | Quick status check. Exit 0 = OK. |
| `scripts/diagnostics.sh` | Captures redacted logs/env for support tickets. |
| `scripts/serve-docs.sh` / `.ps1` | Serves these docs on the LAN. |
| `scripts/prepare-offline-docs.sh` | (Vendor) downloads docsify assets for fully-offline docs. |
| `docs/index.html` | Web documentation entry point. |
| `docs/*.md` | Documentation source. |
| `docs/vendor/` | Offline copies of docsify / prism / themes (vendor-populated). |
| `images/*.tar` | Saved Docker images (vendor-populated). |
| `backups/` | Backup output directory (created on first run). |

## Default ports

| Port | Where it binds | Purpose | Open to LAN? | Open to Internet? |
|------|----------------|---------|---------------|--------------------|
| 80 | host (offline) / 127.0.0.1 (cloud) | Web UI | Yes (offline) | Only via Nginx + TLS (cloud) |
| 3001 | host (offline) / 127.0.0.1 (cloud) | REST API | Yes (offline) | Only via Nginx (cloud) |
| 4001 | host (when docs server running) | Documentation site | Yes | No |
| 5432 | docker internal network | PostgreSQL | **No** | **No** |
| 443 | host (cloud only) | Nginx HTTPS | — | Yes (cloud only) |

## Image tags

| Tag | Source | Notes |
|-----|--------|-------|
| `amis-postgres:offline` | `postgres:16-alpine` retagged | Same upstream image. |
| `amis-api:offline` | Built from `apps/api/Dockerfile` | Fastify API. |
| `amis-web:offline` | Built from `apps/web/Dockerfile` | `VITE_API_URL` baked in at build. |
| `amis-dbmate:offline` | `ghcr.io/amacneil/dbmate:latest` retagged | Migration runner. |

## Useful one-liners

```bash
# Pretty list of all AMIS containers across compose files
docker ps --filter "name=amis"

# Show env actually applied to a running container (secrets visible — careful)
docker inspect amis-api-1 | grep -A2 Env

# Tail the last 100 lines of all services
docker compose -f config/docker-compose.offline.yml logs --tail 100
```
