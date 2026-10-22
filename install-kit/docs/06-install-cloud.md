# 6. Connected VTI Installation

Use this procedure when the VTI server has reliable internet access. The server pulls the API and web images for one pinned AMIS release from GHCR. It does not build images locally.

## 6.1 Prepare the kit

Copy the release kit to the server and create the environment file:

```bash
cd /opt/amis
cp config/.env.online.example config/.env.online
chmod 600 config/.env.online
nano config/.env.online
```

Set `AMIS_VERSION` to the release being installed and replace every placeholder secret. Keep the same `.env.online` file during future updates.

## 6.2 Authenticate and start

If the GHCR packages are private, authenticate with a GitHub token that can read packages. Do not store the token in `.env.online`:

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
docker compose -f config/docker-compose.online.yml --env-file config/.env.online pull
docker compose -f config/docker-compose.online.yml --env-file config/.env.online up -d db redis
docker compose -f config/docker-compose.online.yml --env-file config/.env.online run --rm migrate
docker compose -f config/docker-compose.online.yml --env-file config/.env.online up -d api web
```

Verify the installation:

```bash
./scripts/healthcheck.sh
```

## 6.3 Updating

Take a backup first, change only `AMIS_VERSION`, then pull the new images and run migrations:

```bash
./scripts/backup.sh
sed -i 's/^AMIS_VERSION=.*/AMIS_VERSION=0.25.6/' config/.env.online
docker compose -f config/docker-compose.online.yml --env-file config/.env.online pull api web
docker compose -f config/docker-compose.online.yml --env-file config/.env.online run --rm migrate
docker compose -f config/docker-compose.online.yml --env-file config/.env.online up -d api web
./scripts/healthcheck.sh
```

Never use `latest` for the AMIS API or web images. Keep the previous `AMIS_VERSION` available for rollback, and test database restore before deploying a release with destructive migrations.
