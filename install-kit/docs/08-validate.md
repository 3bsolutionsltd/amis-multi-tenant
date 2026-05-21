# 8. Validate the Installation

Run **before** handing the system to end users.

| # | Check | Expected |
|---|-------|----------|
| 1 | `docker compose -f config/docker-compose.offline.yml ps` | `db`, `api`, `web` running & healthy. |
| 2 | `./scripts/healthcheck.sh` | Exit code `0`. |
| 3 | `curl http://localhost:3001/health` | `{"status":"ok"}` |
| 4 | Browser → `http://<server-IP>` | Login page loads, no console errors. |
| 5 | Log in as platform admin | Dashboard renders, no CORS errors. |
| 6 | Create a test student | Saved, appears in list. |
| 7 | Log in as another role | Role-specific menus only. |
| 8 | Reboot the server | Containers auto-restart, AMIS reachable in <2 min. |
| 9 | Run `./scripts/backup.sh` | Backup file produced, non-zero size. |

If any item fails, do **not** roll out yet — see [13 — Troubleshooting](13-troubleshooting.md).
