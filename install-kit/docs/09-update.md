# 9. Updating an Offline Installation

Updates are delivered as a versioned **install-kit ZIP** through the AMIS release channel. The institution does **not** need internet on the server.

## Procedure

```bash
cd /opt/amis/install-kit

# 1. Take a fresh paired database/uploads backup (REQUIRED)
./scripts/backup.sh

# 2. Stop running containers (data volumes preserved)
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down

# 3. Keep a copy of the current kit and config/.env.offline.
#    Extract the new kit to a separate directory, then copy its files over
#    the existing kit. Do not overwrite config/.env.offline or backups/.

# 4. Load new images
./scripts/load-images.sh

# 5. Apply any new DB migrations
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d db
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline run --rm migrate

# 6. Bring the stack back up
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d

# 7. Confirm the new version and run health checks
cat VERSION
./scripts/healthcheck.sh
```

Keep both files from the pre-upgrade backup pair together. Verify the kit version and health checks before returning AMIS to service.

## Rolling back

```bash
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline down
./scripts/restore.sh \
  backups/amis-<pre-upgrade-stamp>.sql.gz \
  backups/amis-<pre-upgrade-stamp>-uploads.tar.gz
# Re-load the previous image archives before restoring if the schema changed.
```
