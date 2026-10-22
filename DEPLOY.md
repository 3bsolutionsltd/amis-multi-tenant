# AMIS — Production Deployment Runbook

**Domain**: `amis.institute` (frontend) · `api.amis.institute` (API)  
**Server**: Contabo VPS (Ubuntu/Debian) — Docker already installed  
**Stack**: Docker Compose + existing Nginx (TLS via certbot) + PostgreSQL 16

> **VPS context**: The server already runs two other Docker Compose stacks.  
> Native Nginx owns ports 80/443 and acts as the shared reverse proxy for all apps.  
> AMIS containers bind only to loopback ports (3005, 8095) — Nginx proxies them.

---

## Staging-to-Production Release Checklist

Use this checklist to promote the tested AMIS release through the GitHub PR into
`main`, then deploy it to the production stack. Passing CI does **not** merge the
PR or deploy production. Keep staging and production isolated throughout.

### 1. Confirm and merge the release candidate

- [ ] Confirm the PR targets `main` and contains the intended staging-tested changes.
- [ ] Confirm the latest commit on the PR has passing required checks: API tests,
  API build, Web build, and the critical-severity dependency audit.
- [ ] Confirm review comments are resolved and migration changes have been reviewed.
- [ ] Confirm the exact PR commit has passed the required staging/UAT acceptance checks.
- [ ] Merge the PR using the repository's approved merge method.
- [ ] Record the resulting `main` commit SHA as the production release candidate.

### 2. Protect the separate staging environment

- [ ] Confirm staging uses `.env.staging` and
  `docker-compose.staging.yml --project-name amis-staging`; never copy production
  secrets into it.
- [ ] Confirm staging remains on its own database and ports (`3002` API, `8096`
  Web); production uses `3005` API and `8095` Web.
- [ ] Do not run `docker compose down -v`, production migrations, or production
  deployment commands against the staging project.
- [ ] Avoid changing staging during the production cutover unless a separate
  staging deployment is explicitly intended.

### 3. Production preflight — stop if any check is uncertain

- [ ] Confirm the production VPS, public DNS, TLS certificates, and shared Nginx
  configuration are healthy before deployment.
- [ ] Check the currently running Compose projects and port ownership. Port `3001`
  belongs to another service; leave it untouched. AMIS production must bind only
  to `127.0.0.1:3005` (API) and `127.0.0.1:8095` (Web).
- [ ] Confirm whether the AMIS production database contains data. If it does, or
  you are unsure, stop and take a verified database and uploads backup before
  proceeding; do not use `down -v`.
- [ ] Confirm a tested rollback plan and identify the last known-good application
  commit. Do not assume database migrations can safely be reversed.
- [ ] On the VPS, confirm the repository has no unexpected tracked-file changes,
  then update only the production checkout to the merged `main` commit:
  ```bash
  cd /opt/amis
  git status --short
  git fetch origin
  git checkout main
  git pull --ff-only origin main
  git rev-parse --short HEAD
  ```
- [ ] Verify `/opt/amis/.env` exists, is private, and contains production values:
  `APP_URL=https://amis.institute`, `CORS_ORIGIN=https://amis.institute`,
  `VITE_API_URL=https://api.amis.institute`, and an `APP_DATABASE_URL` for the
  `amis_app` role on the production `amis` database. Its password must match
  `APP_DB_PASSWORD` (URL-encode special characters). Never print or share secrets.
- [ ] Validate the production Compose configuration without starting services:
  ```bash
  docker compose --env-file .env -f docker-compose.prod.yml config --quiet
  ```
- [ ] Confirm the AMIS production Nginx virtual hosts proxy the Web to
  `127.0.0.1:8095` and the API to `127.0.0.1:3005`. Preserve other applications'
  virtual hosts and existing Certbot/TLS settings.

### 4. Deploy the production release

- [ ] Apply migrations to the production database and confirm the command exits
  successfully:
  ```bash
  docker compose --env-file .env -f docker-compose.prod.yml up -d db
  docker compose --env-file .env -f docker-compose.prod.yml run --rm migrate
  ```
- [ ] For a newly initialized database only, set the `amis_app` database role
  password to the value used by `APP_DB_PASSWORD` before starting the API. For an
  existing database, verify the role and connection settings instead of
  resetting credentials unnecessarily.
- [ ] Build and start the production API and Web:
  ```bash
  docker compose --env-file .env -f docker-compose.prod.yml up -d --build
  ```
- [ ] If Nginx needed a change, run `nginx -t` successfully before reloading it.
  Do not replace the shared Nginx configuration wholesale.
- [ ] Confirm `docker compose ... ps` shows the database healthy and API/Web
  running; the one-shot migration container should have exited successfully.

### 5. Verify service and business behavior

- [ ] Check the API and Web from the VPS and through the public domains:
  ```bash
  curl -fsS http://127.0.0.1:3005/health
  curl -fsSI http://127.0.0.1:8095/
  curl -fsS https://api.amis.institute/health
  curl -fsSI https://amis.institute/
  ```
- [ ] Inspect API, Web, and migration logs for startup errors, failed migrations,
  database authentication errors, and repeated exceptions.
- [ ] Complete a production smoke test: sign in, confirm tenant and role access,
  open core pages, and verify a safe representative read/write workflow.
- [ ] Verify email/reset links, file uploads, and any enabled integrations using
  production configuration.
- [ ] Verify tenant isolation and confirm a user in one tenant cannot access
  another tenant's records.
- [ ] Confirm HTTPS, certificate renewal, firewall exposure, and backup jobs are
  healthy. Do not expose PostgreSQL or application ports publicly.
- [ ] Monitor logs, health, and user reports after release; record the deployed
  commit, migration result, verification evidence, and any follow-up issues.
- [ ] If a critical check fails, stop further rollout and follow the rollback
  plan. Restore a database backup only with a deliberate recovery decision and
  an understood impact on data written after the backup.

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
| `APP_DB_PASSWORD` | Strong password for the `amis_app` database role |
| `APP_DATABASE_URL` | `postgres://amis_app:<URL-encoded APP_DB_PASSWORD>@db:5432/amis` |
| `JWT_SECRET` | Run `openssl rand -hex 64` on the server |
| `CORS_ORIGIN` | `https://amis.institute` |
| `VITE_API_URL` | `https://api.amis.institute` |
| `APP_URL` | `https://amis.institute` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Production SMTP relay credentials; quote special characters in `.env` |
| `SMTP_FROM`, `SMTP_SECURE` | Verified sender address; use `true` for implicit TLS on port 465 |

Redis is started as an internal-only production service; `REDIS_URL` is wired to
the Compose `redis` service and does not need to be added to `.env`.

`APP_DATABASE_URL` must use the same password as `APP_DB_PASSWORD`. The initial
migrations create `amis_app` with a temporary password, so set the role to
`APP_DB_PASSWORD` after migrations and before starting the API.

### 2.3 Initialize the database and start the application
```bash
# Start PostgreSQL, then apply migrations to the new production database
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm migrate

# Set the amis_app role password interactively; enter APP_DB_PASSWORD when prompted
docker compose -f docker-compose.prod.yml exec db psql -U amis -d amis
# At the psql prompt:
#   \password amis_app
#   \q

# Build and start the API, Web, and internal Redis service
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build the API and Web Docker images
- Start PostgreSQL and apply all migrations to the production database
- Start API (bound to `127.0.0.1:3005`) and Web (bound to `127.0.0.1:8095`)
- Start Redis for the API outbox worker without publishing its port to the host

> DB and app ports are loopback-only — not reachable from the internet, only by Nginx on the same host.

### 2.4 Install the Nginx virtual host config

For a new server, install the repository vhost. On an existing shared Nginx
server, preserve the current TLS/Certbot configuration and update the AMIS API
`proxy_pass` to `http://127.0.0.1:3005` instead of replacing the whole vhost.

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
# Expected: status ok, with database/email/redis checks reporting configured/ok

# Frontend
curl -I https://amis.institute
# Expected: HTTP/2 200
```

Send a password-reset message to a controlled test account and verify it arrives.
Check the API health response for `email: configured` and `redis: configured`;
inspect API logs for SMTP delivery or connection errors. Do not put SMTP
credentials in chat or command-line arguments.

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

## Part 6b — Transactional Email (SMTP / Resend)

AMIS sends transactional email for: password reset, account-setup welcome,
and outbound notifications. Two transports are supported; configure **one**.

### Option A — Resend (recommended for cloud SaaS)

1. Sign up at <https://resend.com> and add `amis.institute` as a sending domain.
2. Add the DNS records Resend gives you to the `amis.institute` zone:
   - **SPF**:  `v=spf1 include:_spf.resend.com -all`
   - **DKIM**: `<resend>._domainkey  CNAME  <selector>.dkim.resend.com`
   - **DMARC**: `_dmarc  TXT  "v=DMARC1; p=quarantine; rua=mailto:postmaster@amis.institute"`
3. After Resend verifies the domain, copy the API key into `.env.staging` /
   `.env.prod`:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM=AMIS <noreply@amis.institute>
   ```
4. Restart the api container:
   ```bash
   docker compose -f docker-compose.staging.yml --project-name amis-staging up -d --no-deps api
   ```
5. Verify with `curl -s https://api.pre.amis.institute/health` — `checks.email`
   should now be `configured`.

### Option B — SMTP (used for VTI-hosted / on-prem deployments)

If the deployment cannot reach Resend (offline VTI, sovereign-cloud requirement),
configure a self-managed SMTP relay (Postfix, Amazon SES, MailerSend, etc.):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=postmaster@amis.local
SMTP_PASS=…
SMTP_FROM=AMIS <noreply@amis.local>
SMTP_SECURE=false   # true → implicit TLS on 465
```

The same SPF / DKIM / DMARC guidance applies — publish the records on
whichever domain you set in `SMTP_FROM`, otherwise mail will land in spam.

### Verifying delivery

- Trigger a password reset for a test account and watch the api logs:
  ```bash
  docker compose -f docker-compose.staging.yml --project-name amis-staging logs -f api | grep -E "mailer|email"
  ```
- A line containing `Sent "Password Reset Request"` (SMTP) or absence of a
  `RESEND_API_KEY not set` warning (Resend) confirms the transport is wired.
- If neither is configured, email is silently skipped and AMIS continues to
  work; the api logs the would-be recipient and subject.

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
- [ ] Port 3005 and 8095 bind to `127.0.0.1` only — not reachable from outside
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
