# 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser shows "Network Error" or CORS error after login | `CORS_ORIGIN` in `.env.offline` does not match the URL used in the browser. | Correct `CORS_ORIGIN`, then run `docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d --no-deps api`. |
| Login spinner never resolves or API reports a database connection error | Database container is stopped, unhealthy, or has incorrect connection settings. | Run `docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline ps`, then inspect the database and API logs. |
| Migrations fail or the `migrate` container exits unsuccessfully | Database is not ready, the release is incomplete, or migrations failed. | Check `docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline logs db migrate`; verify `db/migrations/` exists in the kit. |
| API unavailable after changing the server address | The configured browser origin may no longer match `CORS_ORIGIN`. | Set the exact `http://<server-address>` origin in `config/.env.offline`, then restart the API service. |
| Slow performance with many students | Default Postgres tuning. | Check disk and memory capacity, then use the AMIS support channel specified for your institution for tuning guidance. |
| Wi-Fi clients can't reach AMIS but wired works | LAN segregation / VLAN. | Talk to the network admin. Wi-Fi clients need to reach the server's LAN IP on TCP 80 and 3001. |
| Disk full | Database, uploads, logs, or backups have used the available space. | Check `df -h` and `docker system df`; copy old backups elsewhere before removing them. Do not prune volumes or the offline images needed for recovery. |
| Password reset email does not arrive | Outbound email may not be configured or available on the institute LAN. | Check the institution's configured email service. The offline kit does not include a local password-reset command; contact the institution's AMIS support channel for an approved recovery process. Do not edit the database or rerun first-time setup. |
| `install.sh` exits "Missing images/postgres.tar" | The bundle wasn't fully transferred. | Re-copy the kit from the USB and verify SHA-256 against the supplied checksum. |

## Capture diagnostics for a support ticket

```bash
./scripts/diagnostics.sh
# Writes a redacted diagnostic file — send it only through the institution's AMIS support channel.
```

The diagnostics script automatically **redacts** `POSTGRES_PASSWORD` and `JWT_SECRET` from the captured env.
