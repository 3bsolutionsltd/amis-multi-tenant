# 12. Daily / Weekly / Monthly Operations

## Daily

- `./scripts/healthcheck.sh` — confirm all containers up.
- Confirm last night's backup exists and is non-zero size:
  ```bash
  ls -lh backups/ | tail
  ```

## Weekly

- Tail logs for errors:
  ```bash
  docker compose -f config/docker-compose.offline.yml logs --since 7d api | grep -iE 'error|fatal'
  ```
- Disk usage: `df -h /var/lib/docker`.

## Monthly

- OS security patches.
- Test a backup restore on a separate machine.
- Review user roles and remove leavers.
- Optionally rotate `JWT_SECRET` (forces all users to log in again).

## Useful commands

```bash
# Status
docker compose -f config/docker-compose.offline.yml ps

# Live logs
docker compose -f config/docker-compose.offline.yml logs -f api
docker compose -f config/docker-compose.offline.yml logs -f web

# Restart only the API
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline restart api

# Open psql
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline exec db psql -U amis amis

# List applied migrations
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline run --rm migrate status

# Stop (data preserved)
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down

# Stop AND delete DB data (DESTRUCTIVE)
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down -v
```
