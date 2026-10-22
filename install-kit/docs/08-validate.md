# 8. Validate the Installation

Run **before** handing the system to end users.

| # | Check | Expected |
|---|-------|----------|
| 1 | `docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline ps` | `db` and `api` healthy; `web` running. |
| 2 | `./scripts/healthcheck.sh` | Exit code `0`. |
| 3 | `curl http://localhost:3001/health` | `{"status":"ok"}` |
| 4 | Browser → `http://<server-address>/setup` on a new install | One-time institute setup form loads without console errors. |
| 5 | Complete setup, then sign in as the created administrator | Dashboard renders, no CORS errors. |
| 6 | Create a student using synthetic test data | Saved, appears in the list; remove the test record afterward. |
| 7 | Log in as another role | Role-specific menus only. |
| 8 | Reboot the server | Containers auto-restart; AMIS passes the health check before users resume work. |
| 9 | Run `./scripts/backup.sh` | Matching database and uploads archives produced and verified. |

If any item fails, do **not** roll out yet — see [13 — Troubleshooting](13-troubleshooting.md).
