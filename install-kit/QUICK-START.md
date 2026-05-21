# AMIS — Quick Start Cheat-Sheet

> Print this page and keep it next to the server.

## Install (first time)

```bash
# Linux
sudo ./install.sh
```
```powershell
# Windows
.\install.ps1
```

The installer asks you for:

| Prompt | Example answer |
|--------|----------------|
| Server LAN IP | `192.168.1.100` |
| Postgres password | *(auto-generated, copy it)* |
| JWT secret | *(auto-generated)* |

When it finishes, open `http://<server-IP>` in a browser on the LAN.

## Default credentials

The platform-admin account is supplied by 3B Solutions Ltd. on a separate sheet. Change the password on first login.

## Daily operations

```bash
# Status
docker compose -f config/docker-compose.offline.yml ps

# Logs (live)
docker compose -f config/docker-compose.offline.yml logs -f api

# Restart
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline restart api

# Manual backup
./scripts/backup.sh

# Health check
./scripts/healthcheck.sh
```

## Read the full documentation

Double-click `docs/index.html` — or serve it on the LAN:

```bash
./scripts/serve-docs.sh        # http://<server-ip>:4001
```

## Get help

1. `docs/13-troubleshooting.md`
2. Email **support@3bsolutions.co.ug** with output of `./scripts/diagnostics.sh`.
