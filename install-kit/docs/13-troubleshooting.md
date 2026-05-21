# 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser shows "Network Error" or CORS error after login | `CORS_ORIGIN` in `.env.offline` does not match the URL the browser uses. | Edit `config/.env.offline`, then `docker compose ... up -d --no-deps api`. |
| Login spinner never resolves; API logs show `ECONNREFUSED 127.0.0.1:5432` | DB container not healthy. | `docker compose ... ps` — restart `db`, check disk space. |
| `migrate` exits with `permission denied` | Volume mount path wrong. | Run from `install-kit/` so the `../db/migrations` relative mount resolves. |
| Web shows old API URL after server IP change | `VITE_API_URL` was baked into the image. | Request a rebuilt bundle from 3B Solutions with the new IP, OR set up a stable LAN DNS name and rebuild once. |
| Slow performance with many students | Default Postgres tuning. | Increase `shared_buffers`, `work_mem`. Contact 3B Solutions for a tuned `postgresql.conf`. |
| Wi-Fi clients can't reach AMIS but wired works | LAN segregation / VLAN. | Talk to the network admin. Wi-Fi clients need to reach the server's LAN IP on TCP 80 and 3001. |
| Disk full | DB growth + Docker build cache. | `docker system prune -af`. Move the `pgdata_offline` volume to a larger disk. |
| Forgotten platform-admin password | Reset CLI. | `docker compose ... exec api node dist/scripts/reset-password.js <email>` |
| `install.sh` exits "Missing images/postgres.tar" | The bundle wasn't fully transferred. | Re-copy the kit from the USB and verify SHA-256 against the supplied checksum. |
| Containers running but UI shows "504 Gateway Timeout" (cloud) | Nginx can't reach the API on `127.0.0.1:3001`. | `curl http://127.0.0.1:3001/health` on the VPS; check Nginx vhost. |

## Capture diagnostics for a support ticket

```bash
./scripts/diagnostics.sh
# Writes diag-YYYYmmdd-HHMM.txt — attach to your email to support.
```

The diagnostics script automatically **redacts** `POSTGRES_PASSWORD` and `JWT_SECRET` from the captured env.
