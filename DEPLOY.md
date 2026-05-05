# AMIS — Production Deployment Runbook

**Domain**: `amis.institute` (frontend) · `api.amis.institute` (API)  
**Server**: Contabo VPS (Ubuntu/Debian) — Docker already installed  
**Stack**: Docker Compose + existing Nginx (TLS via certbot) + PostgreSQL 16

> **VPS context**: The server already runs two other Docker Compose stacks.  
> Native Nginx owns ports 80/443 and acts as the shared reverse proxy for all apps.  
> AMIS containers bind only to loopback ports (3001, 8095) — Nginx proxies them.

---

## Prerequisites (one-time, on your local machine)

- SSH access to the VPS (key-based recommended)
- DNS A records already propagated:
  ```
  A  amis.institute      →  <VPS IP>
  A  api.amis.institute  →  <VPS IP>
  ```
  Verify with: `nslookup amis.institute` — must resolve before certbot can issue certs.

---

## Part 1 — VPS First-Time Setup

SSH into the server:
```bash
ssh root@<VPS IP>
```

### 1.1 Docker is already installed ✅
Verify with `docker compose version` — if not present, install the Docker Compose plugin:
```bash
apt-get install -y docker-compose-plugin
```

### 1.2 Install certbot (if not already installed)
```bash
apt-get install -y certbot python3-certbot-nginx
```
Verify: `certbot --version`

### 1.3 Create app directory
```bash
mkdir -p /opt/amis && cd /opt/amis
```

---

## Part 2 — Deploy the Application

### 2.1 Clone the repository
```bash
cd /opt/amis
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git .
```

### 2.2 Create the production .env file
```bash
cp .env.prod.example .env
nano .env
```

Fill in every value — do **not** leave any placeholder as-is:

| Variable | What to put |
|---|---|
| `POSTGRES_PASSWORD` | Strong random password |
| `APP_DB_PASSWORD` | Different strong password |
| `JWT_SECRET` | Run `openssl rand -hex 64` on the server |
| `CORS_ORIGIN` | `https://amis.institute` |
| `VITE_API_URL` | `https://api.amis.institute` |

### 2.3 Build and start all services
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build the API and Web Docker images
- Start PostgreSQL, run all 39+ migrations automatically (via the `migrate` one-shot service)
- Start API (bound to `127.0.0.1:3001`) and Web (bound to `127.0.0.1:8095`)

> DB and app ports are loopback-only — not reachable from the internet, only by Nginx on the same host.

### 2.4 Install the Nginx virtual host config
```bash
cp /opt/amis/nginx/amis.conf /etc/nginx/sites-available/amis.conf
ln -s /etc/nginx/sites-available/amis.conf /etc/nginx/sites-enabled/amis.conf
nginx -t && systemctl reload nginx
```

### 2.5 Issue TLS certificates
```bash
certbot --nginx -d amis.institute -d api.amis.institute
```

Certbot will:
1. Verify domain ownership via HTTP challenge (Nginx must be reloaded first — done above)
2. Write the `ssl_certificate` lines into `amis.conf` automatically
3. Reload Nginx

> Certificates auto-renew via the certbot systemd timer — no manual action needed.

### 2.6 Verify everything is up
```bash
# All containers should show "running" (migrate will show "exited 0" — that's correct)
docker compose -f docker-compose.prod.yml ps

# API health check
curl https://api.amis.institute/health
# Expected: {"status":"ok"}

# Frontend
curl -I https://amis.institute
# Expected: HTTP/2 200
```

---

## Part 3 — Subsequent Deployments (updating the app)

```bash
cd /opt/amis

# Pull latest code
git pull origin main

# 1. Apply any new DB migrations (ALWAYS run this first — see note below)
docker compose -f docker-compose.prod.yml run --rm migrate

# 2. Rebuild images and restart services
docker compose -f docker-compose.prod.yml up -d --build
```

> **Important:** The `migrate` service uses `restart: "no"` and only runs automatically
> on the very first `docker compose up`. On subsequent deploys Docker Compose considers
> it already done and skips it. **Always run `run --rm migrate` explicitly before
> rebuilding** to ensure new migration files are applied.

No Nginx changes needed unless a new domain is added.

---

## Part 4 — Useful Maintenance Commands

```bash
# View live logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Open a psql shell on the DB
docker compose -f docker-compose.prod.yml exec db psql -U amis amis

# Restart a single service
docker compose -f docker-compose.prod.yml restart api

# Full stop (keeps data volumes)
docker compose -f docker-compose.prod.yml down

# Stop AND delete DB data (DESTRUCTIVE — only for reset)
docker compose -f docker-compose.prod.yml down -v

# Check Nginx config after any edits
nginx -t && systemctl reload nginx

# Check TLS cert renewal
certbot renew --dry-run
```

---

## Part 5 — Running migrations manually (if needed)

The `migrate` service runs **only on the first** `docker compose up`; on subsequent deploys
you must run it explicitly (it's idempotent — safe to run multiple times). To run it:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

To check which migrations have already been applied:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate status
```

---

## Part 5b — Staging Environment (pre.amis.institute)

The staging stack runs on the **same VPS** as production, on separate ports (3002 / 8096)
with a separate database (`amis_staging`).

> **Critical:** Every `docker compose` command for staging **must** include
> `--env-file .env.staging`. Omitting it causes Docker to fall back to `.env`
> (production secrets), resulting in the wrong `CORS_ORIGIN` inside the container.

### First-time staging setup

```bash
cd /opt/amis
cp .env.staging.example .env.staging
nano .env.staging   # fill in secrets — use DIFFERENT values from .env (prod)
```

Required values in `.env.staging`:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | Different from prod |
| `JWT_SECRET` | Different from prod |
| `CORS_ORIGIN` | `https://pre.amis.institute` |
| `VITE_API_URL` | `https://api.pre.amis.institute` |
| `VITE_APP_ENV` | `staging` |

```bash
# Install Nginx virtual host and issue TLS certs (first time only)
cp nginx/amis-staging.conf /etc/nginx/sites-available/amis-staging.conf
ln -s /etc/nginx/sites-available/amis-staging.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d pre.amis.institute -d api.pre.amis.institute

# Start staging stack
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging up -d --build

# Apply migrations
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging run --rm migrate
```

### Updating staging

```bash
cd /opt/amis
git pull origin main

# Always include --env-file .env.staging
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging run --rm migrate
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging up -d --build
```

### Useful staging commands

```bash
# Logs
docker compose -f docker-compose.staging.yml --project-name amis-staging logs -f api

# Verify running container has correct env (CORS_ORIGIN must be pre.amis.institute)
docker inspect amis-staging-api-1 | grep CORS_ORIGIN

# Health check
curl -s https://api.pre.amis.institute/health
# Expected: {"status":"ok"}

# psql shell on staging DB
docker compose -f docker-compose.staging.yml --project-name amis-staging exec db psql -U amis amis_staging
```

---

## Part 6 — KTI Tenant Setup (first production login)

After migrations are complete, run the KTI data migration scripts via SSH tunnel:

```bash
# Open an SSH tunnel: local port 5433 → VPS Postgres (loopback only on VPS)
ssh -L 5433:127.0.0.1:5432 root@<VPS IP> -N &

export DATABASE_URL="postgres://amis:<POSTGRES_PASSWORD>@localhost:5433/amis?sslmode=disable"
node db/data-migration/kti/phase1-seed.js
# ... run remaining phases
```

Or use the AMIS platform admin at `https://amis.institute` to create the KTI tenant via the onboarding flow.

---

## Part 7 — UTC Kyema On-Premises (Offline) Deployment

Uganda Technical College — Kyema operates on a local LAN with no guaranteed internet access.
AMIS is deployed as a **self-contained offline bundle** on an institutional server.

### 7.1 Prerequisites (on the build machine — requires internet)

- Docker Desktop running
- Fixed LAN IP assigned to the UTC Kyema server (e.g. `192.168.1.100`)
  - The IP is **baked into the web image at build time** — set it on the server before building

### 7.2 Build the offline bundle (run on dev machine)

```powershell
# Default server IP: 192.168.1.100 — override with -ServerIp
.\scripts\build-offline-bundle.ps1 -ServerIp 192.168.1.100
```

Output: `dist/offline-bundle/` (~600 MB)

What it contains:
```
dist/offline-bundle/
  images/
    postgres.tar          ← postgres:16-alpine
    amis-api.tar          ← API image
    amis-web.tar          ← Web image (VITE_API_URL baked in)
    dbmate.tar            ← migration runner
  docker-compose.offline.yml
  .env.offline.example
  db/migrations/          ← all SQL migrations
  db/data-migration/utc-kyema/
  db/data-migration/lib/
  load-images.ps1         ← helper script for the server
```

### 7.3 Transfer bundle to UTC Kyema server

Copy `dist/offline-bundle/` to USB drive and transfer to the server, or rsync:
```bash
rsync -avz dist/offline-bundle/ administrator@192.168.1.100:/opt/amis-bundle/
```

### 7.4 First-time setup on the UTC Kyema server

> Requires: Docker Desktop (Windows) or Docker Engine (Linux) installed on the server.

```powershell
# Load all Docker images (no internet needed)
cd C:\amis-bundle   # or wherever the bundle was copied
.\load-images.ps1
```

Configure environment:
```powershell
Copy-Item .env.offline.example .env.offline
notepad .env.offline   # or edit with any text editor
```

Set these values in `.env.offline`:
| Variable | What to put |
|---|---|
| `POSTGRES_PASSWORD` | Strong local password (min 16 chars, no `$` signs) |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CORS_ORIGIN` | `http://192.168.1.100` (the server LAN IP — no trailing slash) |
| `VITE_API_URL` | Already baked into the image — leave as `http://192.168.1.100:3001` |

### 7.5 Start the stack

```powershell
# Start all services
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d

# Apply migrations (first time only)
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate
```

Verify:
```
# API health check from the server
curl http://localhost:3001/health
# → {"status":"ok"}

# Web from any LAN device
# Open browser: http://192.168.1.100
```

### 7.6 Seed UTC Kyema master data (first time only)

```bash
# From the bundle directory — requires Node.js on the server
# OR run from the dev machine with DATABASE_URL pointing to the server via SSH tunnel:
ssh -L 5434:127.0.0.1:5432 administrator@192.168.1.100 -N &

export DATABASE_URL="postgres://amis:<POSTGRES_PASSWORD>@localhost:5434/amis?sslmode=disable"
node db/data-migration/utc-kyema/phase1-seed.js

# Verify seed landed correctly
node db/data-migration/utc-kyema/validate-dry-run.js
```

### 7.7 Updating the UTC Kyema deployment

When a new version is available:
1. Run `build-offline-bundle.ps1` again on the dev machine (same server IP)
2. Transfer only the new `images/amis-api.tar` and `images/amis-web.tar` to the server
3. On the server:
   ```powershell
   docker load -i images\amis-api.tar
   docker load -i images\amis-web.tar
   docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate
   docker compose -f docker-compose.offline.yml --env-file .env.offline up -d
   ```

### 7.8 UTC Kyema Security Notes

- Port `3001` (API) and port `80` (Web) are bound to `0.0.0.0` — accessible from any device on the LAN
- No TLS in the initial offline setup — add a reverse proxy with a self-signed cert if required later
- Keep `.env.offline` on the server only — never commit it to git
- The `db` service does **not** expose port 5432 to the LAN — PostgreSQL is accessible only to containers

---

## Security Checklist

- [ ] `.env` is not committed to git (verified by `.gitignore`)
- [ ] `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `JWT_SECRET` are all unique strong values
- [ ] Port 5432 is NOT exposed to the internet (no `ports:` on `db` service — loopback only)
- [ ] Port 3001 and 8095 bind to `127.0.0.1` only — not reachable from outside
- [ ] SSH password auth disabled on VPS (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ] TLS certificates issued and Nginx serving HTTPS for both domains
- [ ] `certbot renew --dry-run` succeeds (auto-renewal is working)

---

## Part 2 — Deploy the Application

### 2.1 Clone the repository
```bash
cd /opt/amis
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git .
```

### 2.2 Create the production .env file
```bash
cp .env.prod.example .env
nano .env
```

Fill in every value — do **not** leave any placeholder as-is:

| Variable | What to put |
|---|---|
| `POSTGRES_PASSWORD` | Strong random password |
| `APP_DB_PASSWORD` | Different strong password |
| `JWT_SECRET` | Run `openssl rand -hex 64` on the server |
| `CORS_ORIGIN` | `https://amis.institute` |
| `VITE_API_URL` | `https://api.amis.institute` |

### 2.3 Build and start all services
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build the API and Web Docker images
- Start PostgreSQL, run all migrations automatically (via the `migrate` one-shot service), then start API, Web, and Caddy
- Caddy auto-fetches TLS certificates for both domains on first request

> The `migrate` service runs `dbmate up` against the DB container then exits with code 0. All 39+ migrations are applied automatically on every deploy — including the first.

### 2.4 Verify everything is up
```bash
# All 4 containers should show "running"
docker compose -f docker-compose.prod.yml ps

# Health check
curl https://api.amis.institute/health
# Expected: {"status":"ok"}

# Frontend
curl -I https://amis.institute
# Expected: HTTP/2 200
```

---

## Part 3 — Subsequent Deployments (updating the app)

```bash
cd /opt/amis

# Pull latest code
git pull origin main

# 1. Apply any new DB migrations first
docker compose -f docker-compose.prod.yml run --rm migrate

# 2. Rebuild images and restart
docker compose -f docker-compose.prod.yml up -d --build
```

> **Always run migrate before rebuilding.** The migrate service only auto-runs on the
> first deployment; Docker Compose skips it on subsequent `up` calls.

---

## Part 4 — Useful Maintenance Commands

```bash
# View live logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy

# Open a psql shell on the DB
docker compose -f docker-compose.prod.yml exec db psql -U amis amis

# Restart a single service
docker compose -f docker-compose.prod.yml restart api

# Full stop (keeps data volumes)
docker compose -f docker-compose.prod.yml down

# Stop AND delete DB data (DESTRUCTIVE — only for reset)
docker compose -f docker-compose.prod.yml down -v
```

---

## Part 5 — Running migrations manually (if needed)

The `migrate` service runs **only on the first** `docker compose up`; run it explicitly
on every subsequent deploy (it's idempotent). To run it standalone:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

To check which migrations have already been applied:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate status
```

---

## Part 6 — KTI Tenant Setup (first production login)

After migrations are complete, the KTI data migration scripts can be re-run against the production DB from your local machine:

```bash
# Point at production DB (via SSH tunnel for security)
ssh -L 5433:localhost:5432 root@<VPS IP> -N &

export DATABASE_URL="postgres://amis:<POSTGRES_PASSWORD>@localhost:5433/amis?sslmode=disable"
node db/data-migration/kti/phase1-seed.js
# ... etc
```

Or log into the AMIS platform admin at `https://amis.institute` and use the onboarding flow to create the KTI tenant.

---

## Security Checklist

- [ ] `.env` file is not committed to git (verified by `.gitignore`)
- [ ] `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `JWT_SECRET` are all unique strong values
- [ ] Port 5432 is NOT exposed to the internet (confirmed — no host port in prod compose)
- [ ] Port 3000 is NOT exposed to the internet (confirmed — `expose` only, not `ports`)
- [ ] SSH password auth disabled on VPS (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ] `ufw` enabled with only 22, 80, 443 open
- [ ] Caddy data volume persisted (TLS certs survive container restarts)
