# 11. Security Hardening

| Area | Action |
|------|--------|
| **Secrets** | Never commit or email `.env.offline`. `chmod 600 config/.env.offline`. |
| **OS users** | Run Docker as a non-root user added to the `docker` group. |
| **Network access** | Restrict ports `:80` and `:3001` to the institution's trusted LAN. Do not expose them directly to the internet. |
| **Database port** | `5432` must **not** appear in `ss -tlnp`. Only the internal docker network sees it. |
| **Backups** | Encrypt off-site copies (e.g. `age`, VeraCrypt) before shipping to USB. |
| **OS updates** | Monthly: `apt-get update && apt-get -y upgrade && reboot`. |
| **Audit** | Review API logs with `docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline logs api`. |
| **Roles** | Apply least privilege: `admin`, `registrar`, `finance`, `hod`, `instructor`, `principal`, `dean`. |
| **Sessions** | JWT tokens are short-lived. Refresh tokens rotate on use. |
| **Passwords** | Use a unique, strong password for each account. Do not share credentials. |

## Network firewall

The Compose file publishes the Web and API ports on the host network interfaces. Restrict inbound access to the institution's LAN using the server and network firewall policy. Docker-published ports may not be filtered by basic UFW rules as expected; verify that ports 80 and 3001 are unreachable from outside the LAN. Keep PostgreSQL port 5432 unexposed.

## Reporting a vulnerability

Report suspected vulnerabilities through the private security contact specified in the institution's AMIS support agreement.
