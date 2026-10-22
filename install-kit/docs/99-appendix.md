# Appendix — Files & Ports Reference

## File reference

| Path (inside `install-kit/`) | Purpose |
|------------------------------|---------|
| `README.md` | Top-level "start here". |
| `QUICK-START.md` | Printable cheat-sheet. |
| `MANIFEST.md` | Release contents and validation checklist. |
| `VERSION` | Version of this installation kit. |
| `RELEASE-MANIFEST.json` | Source revision, platform, migrations, and image checksums. |
| `install.sh` | One-command Ubuntu Server installer. |
| `config/docker-compose.offline.yml` | Container orchestration. |
| `config/.env.offline.example` | Env template. Copy to `.env.offline`. |
| `config/.env.offline` | Real env file (created by installer). **Mode 600. Never commit.** |
| `scripts/load-images.sh` | Loads `images/*.tar` into Docker. |
| `scripts/backup.sh` | Creates a matched database and uploads backup pair. |
| `scripts/restore.sh` | Restores a matched database and uploads backup pair. |
| `scripts/healthcheck.sh` | Quick status check. Exit 0 = OK. |
| `scripts/diagnostics.sh` | Captures redacted logs/env for support tickets. |
| `scripts/serve-docs.sh` | Serves these docs on the LAN. |
| `docs/index.html` | Web documentation entry point. |
| `docs/*.md` | Documentation source. |
| `docs/vendor/` | Offline copies of docsify / prism / themes (included in a release bundle). |
| `images/*.tar` | Saved Docker images (included in a release bundle). |
| `backups/` | Backup output directory (created on first run). |

## Default ports

| Port | Where it binds | Purpose | Required access |
|------|----------------|---------|-----------------|
| 80 | Host network interfaces | Web UI | Institution LAN only |
| 3001 | Host network interfaces | REST API used by the Web UI | Institution LAN only |
| 4001 | Host when docs server is running | Documentation site | Institution LAN only |
| 5432 | Internal Docker network | PostgreSQL | Not exposed on the host |

Do not expose ports 80, 3001, or 4001 directly to the internet. Docker-published ports may not be filtered by basic UFW rules as expected; verify network firewall behavior.

## Image tags

| Tag | Source | Notes |
|-----|--------|-------|
| `amis-postgres:offline` | `postgres:16-alpine` retagged | Same upstream image. |
| `amis-api:offline` | Built from `apps/api/Dockerfile` | Fastify API. |
| `amis-web:offline` | Built from `apps/web/Dockerfile` | Resolves the API host at runtime from the browser hostname. |
| `amis-dbmate:offline` | Included in the versioned image archive | Migration runner; verify its archive checksum against `RELEASE-MANIFEST.json`. |

## Useful one-liners

```bash
# Show service status
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline ps

# Tail the last 100 lines of all services
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline logs --tail 100
```
