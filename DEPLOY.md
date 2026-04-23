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

# Rebuild images and restart (migrate runs automatically, applies any new migrations)
docker compose -f docker-compose.prod.yml up -d --build
```

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

The `migrate` service runs automatically on every `docker compose up`. To run standalone:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

To check which migrations have already been applied:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate status
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

# Rebuild images, run any new migrations, restart api+web
# (DB and Caddy stay up; migrate service runs and exits cleanly)
docker compose -f docker-compose.prod.yml up -d --build
```

The `migrate` service will apply any new migrations automatically before the API comes up.

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

The `migrate` service runs automatically on every `docker compose up`. To run it standalone (e.g. after a hotfix to migrations):

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
