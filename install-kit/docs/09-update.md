# 9. Updating an Offline Installation

Updates are delivered as a **new install-kit ZIP** from 3B Solutions Ltd. The institution does **not** need internet on the server.

## Procedure

```bash
cd /opt/amis/install-kit

# 1. Take a fresh backup (REQUIRED)
./scripts/backup.sh

# 2. Stop running containers (data volumes preserved)
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down

# 3. Replace files from the new kit:
#       images/*.tar                (overwrite)
#       config/docker-compose.offline.yml (overwrite)
#       db/migrations/              (overwrite — only adds new files)
#       docs/                       (overwrite)
#    DO NOT overwrite config/.env.offline.

# 4. Load new images
./scripts/load-images.sh

# 5. Apply any new DB migrations
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d db
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline run --rm migrate

# 6. Bring the stack back up
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d

# 7. Confirm the new version
./scripts/healthcheck.sh
```

Verify the version banner in the UI footer matches the new release before announcing the update.

## Rolling back

```bash
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down
./scripts/restore.sh backups/amis-<pre-upgrade-stamp>.sql.gz
# Re-load the previous image tars, then up -d.
```
