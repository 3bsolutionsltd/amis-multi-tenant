# AMIS — Quick Start Cheat-Sheet

> Print this page and keep it next to the server.

## Install (first time)

```bash
# Ubuntu Server
sudo ./install.sh
```

The installer asks you for:

| Prompt | Example answer |
|--------|----------------|
| Server LAN IP or hostname | `192.168.1.100` |

When it finishes, open `http://<server-address>/setup` in a browser on the LAN and create the institute and initial administrator.

There are no shared default administrator credentials.

## Daily operations

```bash
# Status
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline ps

# Logs (live)
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline logs -f api

# Restart
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline restart api

# Manual backup
./scripts/backup.sh           # writes matched database and uploads archives

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
2. Send the output of `./scripts/diagnostics.sh` through the AMIS support channel specified for your institution.
