# AMIS — Technical Installation Manual

**Audience:** VTI / Institutional Technical Teams (System Administrators, IT Officers)
**System:** Academic Management Information System (AMIS) v3.0
**Vendor:** 3B Solutions Ltd.
**Document version:** 1.0 — May 2026

---

## 1. Purpose & Scope

This manual is the authoritative installation reference for technical staff at a Vocational Training Institution (VTI) that has licensed AMIS. It covers:

1. **Offline / On-Premises (LAN) deployment** — *primary mode*, recommended for the majority of VTIs because it does **not** require continuous internet, runs on a single in-house server, and keeps all student data inside the institution.
2. **Cloud / VPS deployment** — secondary mode for institutions with reliable internet that prefer remote hosting.
3. **Hybrid considerations** — running offline as primary with periodic sync to a cloud node (data-export workflow).

> **Offline-first is the default.** Every section is structured so that an institution **without internet** at the server site can still bring the system up using only the offline bundle (USB / external drive) supplied by 3B Solutions Ltd.

---

## 2. System Architecture

AMIS is a multi-tenant SaaS-style platform packaged as **four Docker containers** that run together on a single host. The same image set runs in offline (LAN) mode and cloud mode — only configuration changes.

```
                      ┌────────────────────────────────────────────┐
                      │   Institutional LAN (or VPS in cloud mode) │
                      │                                            │
   Browser  ────►  ┌──┴──┐ HTTP/HTTPS                              │
  (Staff /         │ Web │ (React SPA, served by Nginx in image)   │
   Students        │ :80 │                                         │
   on LAN)         └──┬──┘                                         │
                      │ /api/* reverse-proxied / direct to API     │
                      ▼                                            │
                   ┌─────┐  REST / JSON                            │
                   │ API │  Fastify + TypeScript                   │
                   │:3001│  JWT auth, Zod validation               │
                   └──┬──┘                                         │
                      │ libpq (TCP)                                │
                      ▼                                            │
                   ┌─────┐                                         │
                   │ DB  │  PostgreSQL 16 (RLS-enforced isolation) │
                   │:5432│  Persistent volume: pgdata_offline      │
                   └─────┘                                         │
                                                                   │
                   ┌────────┐                                      │
                   │migrate │  dbmate (one-shot job)               │
                   └────────┘  Runs all 39+ SQL migrations          │
                      └────────────────────────────────────────────┘
```

### 2.1 Components

| Component | Image | Role |
|-----------|-------|------|
| `db` | `postgres:16-alpine` | PostgreSQL with Row-Level Security; the system of record. |
| `api` | `amis-api:offline` | Fastify REST API, JWT auth, file uploads, reporting. |
| `web` | `amis-web:offline` | React SPA built with Vite, served by Nginx. |
| `migrate` | `amis-dbmate:offline` | One-shot container that applies SQL migrations on startup, then exits. |

### 2.2 Multi-Tenancy & Data Isolation

* AMIS is **multi-tenant**: a single AMIS install can host more than one institution (e.g. KTI + UTC Kyema) if needed.
* Tenant isolation is enforced at the **database layer** via PostgreSQL Row-Level Security (RLS).
* Every API request first sets the tenant context with `withTenant(tenantId, callback)` before running any query — cross-tenant access is structurally impossible from the application code.
* For most VTIs the install will host **one tenant only** (the institution itself).

### 2.3 Default Network Layout

| Environment | Web port | API port | DB port |
|-------------|---------|---------|---------|
| Offline / LAN | `:80` (HTTP, exposed on LAN) | `:3001` (exposed on LAN) | not exposed (internal Docker network only) |
| Cloud / VPS | `127.0.0.1:8095` (proxied by Nginx with TLS) | `127.0.0.1:3001` (proxied by Nginx) | not exposed |

---

## 3. Hardware & Software Requirements

### 3.1 Server hardware (minimum)

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| CPU | 2 cores | 4+ cores | Any x86-64; no GPU required. |
| RAM | 4 GB | 8 GB | Postgres + Node.js + Nginx. |
| Disk | 40 GB SSD | 120 GB SSD | Allow growth for student records, uploads, DB backups. |
| Network | 100 Mb LAN | 1 Gb LAN | Internet only required for first-time bundle transfer / updates. |
| UPS | Recommended | Strongly recommended | Prevents DB corruption on power loss. |

### 3.2 Server operating system

Either of the following is supported:

* **Ubuntu Server 22.04 LTS** (recommended)
* **Debian 12**
* **Windows Server 2019/2022** (Docker Desktop or Docker Engine for Windows) — supported but Linux is preferred.

### 3.3 Required software on the server

| Software | Version | Purpose |
|----------|---------|---------|
| Docker Engine | 24+ | Runs all four containers. |
| Docker Compose plugin | v2+ | Orchestrates the stack. |
| `bash` / PowerShell 5+ | — | For running the helper scripts. |
| (Optional) Node.js 20 | — | Only needed if you will run the data-import scripts on the server. |

> If the server is **fully offline** at the time of install, Docker Engine must be pre-installed by the technical team using their distro's offline package (e.g. `.deb` files placed on USB). Docker itself is not bundled in the AMIS offline package.

### 3.4 Client devices (staff / students)

* Any modern browser — Chrome, Edge, Firefox (last 2 versions), Safari 16+.
* Connected to the same LAN as the AMIS server (offline mode) or to the internet (cloud mode).
* No client-side install — AMIS is a web application.

---

## 4. Pre-Install Checklist

Before you begin, confirm with 3B Solutions / the institution:

- [ ] Server hardware meets §3.1 and is racked, powered, and reachable on the LAN.
- [ ] Server's **static LAN IP** is allocated (e.g. `192.168.1.100`). This IP **must not change** after install (it is baked into the web bundle).
- [ ] Docker Engine + Docker Compose plugin are installed on the server (`docker --version`, `docker compose version`).
- [ ] You have received the **AMIS offline bundle** (USB / external drive) from 3B Solutions Ltd. The bundle is named `offline-bundle/` and contains:
  - `images/postgres.tar`, `images/amis-api.tar`, `images/amis-web.tar`, `images/dbmate.tar`
  - `docker-compose.offline.yml`
  - `.env.offline.example`
  - `db/migrations/` (all SQL migrations)
  - `db/data-migration/` (institution-specific seed scripts, if applicable)
  - `load-images.ps1` (Windows) / `load-images.sh` (Linux helper if provided)
- [ ] You have the institution's **license key / activation details** from 3B Solutions Ltd.
- [ ] DNS / hostname plan for the server (optional but recommended — e.g. `amis.kti.local`).
- [ ] A **backup policy** is agreed (where DB dumps will be stored — see §10).

---

## 5. Offline / On-Premises Installation (PRIMARY MODE)

This section installs AMIS on a single LAN server using the offline bundle. It assumes **no internet access on the server** — all images and code are loaded from the bundle.

### 5.1 Step 1 — Prepare the server

```bash
# Linux (Ubuntu/Debian)
sudo mkdir -p /opt/amis
sudo chown $USER:$USER /opt/amis
cd /opt/amis
```

```powershell
# Windows Server
New-Item -ItemType Directory -Force -Path C:\amis
Set-Location C:\amis
```

Copy the entire `offline-bundle/` folder from the USB drive into `/opt/amis` (Linux) or `C:\amis` (Windows).

After the copy you should see:

```
/opt/amis/
├── images/
│   ├── postgres.tar
│   ├── amis-api.tar
│   ├── amis-web.tar
│   └── dbmate.tar
├── db/
│   ├── migrations/
│   └── data-migration/
├── docker-compose.offline.yml
├── .env.offline.example
└── load-images.ps1
```

### 5.2 Step 2 — Verify Docker is running

```bash
docker --version
docker compose version
docker info | head -n 5
```

If Docker is **not** installed, install it first using the offline `.deb` packages provided by your distro vendor. AMIS does not ship Docker itself.

### 5.3 Step 3 — Load the AMIS Docker images

Linux:
```bash
cd /opt/amis
docker load < images/postgres.tar
docker load < images/amis-api.tar
docker load < images/amis-web.tar
docker load < images/dbmate.tar
```

Windows (PowerShell):
```powershell
cd C:\amis
.\load-images.ps1
```

Confirm:
```bash
docker images | grep -E 'amis|postgres'
# Expected:
# amis-api      offline   ...
# amis-web      offline   ...
# amis-postgres offline   ...
# amis-dbmate   offline   ...
```

### 5.4 Step 4 — Create the environment file

```bash
cp .env.offline.example .env.offline
nano .env.offline      # or: notepad .env.offline (Windows)
```

Fill in **every** value. Do not leave any placeholder.

| Variable | What to set | How |
|----------|-------------|-----|
| `POSTGRES_PASSWORD` | A strong random password for the DB superuser. | `openssl rand -base64 32` (Linux). Avoid `$` characters. |
| `JWT_SECRET` | 64 random hex bytes. **Never share or commit.** | `openssl rand -hex 64` |
| `CORS_ORIGIN` | `http://<server-LAN-IP>` — no trailing slash. | e.g. `http://192.168.1.100` |
| `VITE_API_URL` | `http://<server-LAN-IP>:3001` | e.g. `http://192.168.1.100:3001` |
| `POSTGRES_USER` | Leave as `amis` unless you have a reason to change. | — |
| `POSTGRES_DB` | Leave as `amis`. | — |

> **IP-changes warning:** `VITE_API_URL` is **baked into the web image at build time**. If the server's LAN IP changes after install, request a re-built bundle from 3B Solutions Ltd. with the new IP, or set up a DNS name on the LAN router and use that.

Store `.env.offline` securely — it contains secrets.

### 5.5 Step 5 — Bring up the database and apply migrations

```bash
cd /opt/amis

# Start only the database first
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d db

# Wait ~10 seconds for PG to be ready, then run migrations
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate

# Expected: migrations applied successfully — exit code 0
```

The `migrate` container exits after applying all pending SQL files in `db/migrations/`. This is a **one-shot** job and is idempotent — running it again is safe.

### 5.6 Step 6 — Start the full stack

```bash
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d
docker compose -f docker-compose.offline.yml --env-file .env.offline ps
```

Expected output:
* `db` — running, healthy
* `api` — running, healthy
* `web` — running
* `migrate` — exited (0)

### 5.7 Step 7 — Seed institutional master data (first install only)

If 3B Solutions has supplied institution-specific seed scripts (e.g. for UTC Kyema), run them once:

```bash
# From the server (requires Node 20 on the host) OR
# from a workstation with an SSH tunnel to the server
cd /opt/amis
node db/data-migration/utc-kyema/phase1-seed.js
# ... run remaining phases as documented in db/data-migration/<institution>/README.md
```

If your institution does **not** have pre-built seed scripts, skip this step — you will create users, departments, programmes, and courses through the AMIS web UI as the platform admin (§7).

### 5.8 Step 8 — Smoke-test from the server

```bash
# API health
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Web page returns HTTP 200
curl -I http://localhost
```

### 5.9 Step 9 — Smoke-test from a LAN client

From any laptop on the same network as the server:

1. Open a browser and visit `http://<server-LAN-IP>` (e.g. `http://192.168.1.100`).
2. The AMIS login page must load.
3. Sign in with the platform-admin credentials supplied by 3B Solutions Ltd.
4. Confirm that menus, dashboards, and the student list load without "Network Error".

If you see a CORS error, re-check `CORS_ORIGIN` in `.env.offline` matches **exactly** the URL the browser uses.

### 5.10 Step 10 — Make Docker auto-start on boot

```bash
sudo systemctl enable docker      # Linux

# AMIS containers already use restart: always, so they restart with Docker.
```

On Windows Server, ensure Docker Desktop / Docker Engine service is set to **Automatic** start.

---

## 6. Cloud / VPS Installation (SECONDARY MODE)

Use this mode only if the institution has reliable internet at the server site and prefers remote hosting. Otherwise stay with §5.

### 6.1 Prerequisites

* A VPS (Contabo, DigitalOcean, Hetzner, etc.) running Ubuntu 22.04 LTS.
* SSH key access as `root` or a sudo user.
* Two DNS A records pointing to the VPS public IP:
  * `amis.<your-domain>` (frontend)
  * `api.amis.<your-domain>` (API)
* Ports `80` and `443` open on the firewall.

### 6.2 Steps

```bash
ssh root@<VPS-IP>
apt-get update
apt-get install -y docker.io docker-compose-plugin certbot python3-certbot-nginx nginx git

mkdir -p /opt/amis && cd /opt/amis
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git .

cp .env.prod.example .env
nano .env            # fill POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, VITE_API_URL

docker compose -f docker-compose.prod.yml up -d --build

# Install Nginx vhost + TLS
cp nginx/amis.conf /etc/nginx/sites-available/amis.conf
ln -s /etc/nginx/sites-available/amis.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d amis.<domain> -d api.amis.<domain>
```

For full cloud deployment runbook (incl. staging, SMTP/Resend email, certbot renewal), see [DEPLOY.md](DEPLOY.md). The cloud mode reuses the same image and migration system as offline mode — the only differences are:

* TLS termination at Nginx with Let's Encrypt.
* API and Web bind to `127.0.0.1` only; Nginx is the single public entry point.
* `.env` instead of `.env.offline`.

---

## 7. Post-Install: Tenant & Admin Setup

After the stack is running, AMIS still needs at least one **tenant** (the institution) and one **platform admin** to be usable.

### 7.1 If 3B Solutions seeded your tenant

Skip this section. Use the platform-admin credentials supplied to you and continue at §7.3.

### 7.2 If you must create the tenant manually

The supplied installation includes a provisioning script:

```bash
node scripts/provision-tenant.js \
    --name "Kyema Technical Institute" \
    --slug "kti" \
    --admin-email "admin@kti.ac.ug" \
    --admin-password "<temporary-strong-password>"
```

The script creates:
1. A row in `platform.tenants`.
2. A schema-level role for the tenant.
3. The first `admin` user.

### 7.3 First login & admin checklist

Log in at `http://<server-IP>/login` with the platform-admin account, then:

1. Force a password change.
2. Create departments, programmes, intakes, courses, and academic calendars.
3. Create user accounts for: registrar, finance, HODs, instructors, principal, dean.
4. Import students via CSV (see [USER_MANUAL.md](USER_MANUAL.md) → "Bulk Student Import").
5. Publish a **config version** to lock the visible modules (Admissions, Enrolment, Marks, Fees, Clearance, Alumni).

---

## 8. Validating the Installation

Run through this checklist **before** handing the system to end users.

| # | Check | Expected |
|---|-------|----------|
| 1 | `docker compose -f docker-compose.offline.yml ps` | `db`, `api`, `web` all running and healthy. |
| 2 | `curl http://localhost:3001/health` | `{"status":"ok"}` |
| 3 | Login page loads on a LAN client | Login form rendered, no console errors. |
| 4 | Login as platform admin | Dashboard renders, no CORS errors. |
| 5 | Create a test student | Saved, appears in student list. |
| 6 | Log out, log in as a different role | Role-specific menus only. |
| 7 | Restart the server (`reboot`) | Containers come up automatically; AMIS reachable in <2 min. |
| 8 | Run a manual DB backup (§10.1) | `.dump` file produced, non-zero size. |

---

## 9. Updating an Offline Installation

VTIs without internet on the server cannot `git pull`. Updates are delivered as a **new offline bundle** from 3B Solutions Ltd. The procedure:

```bash
cd /opt/amis

# 1. Take a fresh DB backup (REQUIRED — see §10.1)
docker compose -f docker-compose.offline.yml --env-file .env.offline exec db \
  pg_dump -U amis amis > /opt/amis/backups/pre-upgrade-$(date +%F).sql

# 2. Stop running containers (data volumes are preserved)
docker compose -f docker-compose.offline.yml --env-file .env.offline down

# 3. Replace files from the new bundle
#    - images/*.tar               (overwrite)
#    - docker-compose.offline.yml (overwrite)
#    - db/migrations/             (overwrite — only adds new files)
#    - DO NOT overwrite .env.offline

# 4. Load the new images
docker load < images/amis-api.tar
docker load < images/amis-web.tar
# (postgres / dbmate usually unchanged — re-load only if instructed)

# 5. Apply any new DB migrations
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d db
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate

# 6. Bring the stack back up
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d
```

Verify the version banner in the UI footer matches the new release before announcing the update.

---

## 10. Backup & Restore

### 10.1 Daily database backup (recommended)

Create `/opt/amis/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DEST=/opt/amis/backups
mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%d_%H%M)
docker compose -f /opt/amis/docker-compose.offline.yml --env-file /opt/amis/.env.offline \
  exec -T db pg_dump -U amis amis | gzip > "$DEST/amis-$STAMP.sql.gz"
# Retain 30 days
find "$DEST" -type f -name 'amis-*.sql.gz' -mtime +30 -delete
```

Schedule it:

```bash
chmod +x /opt/amis/scripts/backup.sh
sudo crontab -e
# Add:
0 1 * * *   /opt/amis/scripts/backup.sh >> /var/log/amis-backup.log 2>&1
```

> Copy backups off the server periodically (USB, NAS, secondary VTI server).

### 10.2 Restoring from backup

```bash
# Stop the API so nothing writes during restore
docker compose -f docker-compose.offline.yml --env-file .env.offline stop api web

# Drop and recreate the schema
docker compose -f docker-compose.offline.yml --env-file .env.offline exec -T db \
  psql -U amis -c "DROP DATABASE amis; CREATE DATABASE amis OWNER amis;"

# Restore
gunzip -c /opt/amis/backups/amis-2026-05-21_0100.sql.gz | \
  docker compose -f docker-compose.offline.yml --env-file .env.offline exec -T db \
  psql -U amis amis

# Restart the app
docker compose -f docker-compose.offline.yml --env-file .env.offline start api web
```

### 10.3 Backing up uploads (optional)

The API writes uploads to the `uploads` Docker volume. To snapshot it:

```bash
docker run --rm -v amis_uploads:/data -v /opt/amis/backups:/backup \
  alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

---

## 11. Security Hardening

| Area | Action |
|------|--------|
| Secrets | Never commit `.env.offline`. Restrict file mode: `chmod 600 .env.offline`. |
| OS users | Run Docker as a non-root user added to the `docker` group. |
| Firewall | Block ALL inbound ports from outside the LAN. Only `:80` (and `:443` if TLS terminated locally) and `:3001` should be reachable inside the LAN. Block from WAN entirely. |
| TLS on LAN | Optional but recommended — issue a self-signed or internal-CA cert and front the stack with the institution's existing reverse proxy. |
| Database | DB port `5432` is **never** exposed outside the Docker network. Verify with `ss -tlnp | grep 5432` — no listener should be on the host's LAN IP. |
| Backups | Encrypt off-site copies (e.g. with `age` or VeraCrypt) before shipping to USB. |
| Updates | Apply OS security patches monthly: `apt-get update && apt-get -y upgrade && reboot`. |
| Audit | AMIS logs all auth events; review `docker logs amis-api-1 \| grep AUDIT` regularly. |
| Roles | Use the principle of least privilege when assigning `admin`, `registrar`, `finance`, `hod`, `instructor`, `principal`, `dean` roles. |

---

## 12. Operational Procedures

### 12.1 Daily

* Verify all containers are running: `docker compose -f docker-compose.offline.yml ps`.
* Confirm last night's backup file exists and is non-zero size.

### 12.2 Weekly

* Tail logs and look for repeated errors:
  ```bash
  docker compose -f docker-compose.offline.yml logs --since 7d api | grep -iE 'error|fatal'
  ```
* Free disk check: `df -h /var/lib/docker`.

### 12.3 Monthly

* OS security patches.
* Test a backup restore on a separate machine (do **not** restore over production).
* Rotate `JWT_SECRET` if the institution's policy requires it (forces all users to log in again).

### 12.4 Useful day-to-day commands

```bash
# Live logs
docker compose -f docker-compose.offline.yml logs -f api
docker compose -f docker-compose.offline.yml logs -f web

# Restart only the API
docker compose -f docker-compose.offline.yml --env-file .env.offline restart api

# Open a psql shell
docker compose -f docker-compose.offline.yml --env-file .env.offline exec db psql -U amis amis

# List applied migrations
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate status

# Stop everything (data preserved)
docker compose -f docker-compose.offline.yml --env-file .env.offline down

# Stop AND DELETE all DB data (DESTRUCTIVE)
docker compose -f docker-compose.offline.yml --env-file .env.offline down -v
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser shows "Network Error" / CORS error after login | `CORS_ORIGIN` in `.env.offline` does not match the URL the browser is using. | Update `CORS_ORIGIN`, then `docker compose ... up -d --no-deps api`. |
| Login spinner never completes; API logs show `ECONNREFUSED 127.0.0.1:5432` | DB container not healthy. | `docker compose ... ps` — restart `db`, check disk space. |
| `migrate` exits with `permission denied` | Volume mount points to a path that doesn't exist. | Run from `/opt/amis`; ensure `db/migrations/` was copied from the bundle. |
| Web image still shows old API URL after server IP change | `VITE_API_URL` is baked into the image at build time. | Request a rebuilt offline bundle from 3B Solutions Ltd. with the new IP, OR set up a stable LAN DNS name and rebuild once. |
| Slow performance with many students | Default Postgres tuning. | Increase `shared_buffers`, `work_mem`; add a `postgresql.conf` override volume. Contact 3B Solutions for a tuned config. |
| Cannot reach AMIS from a Wi-Fi client but wired works | LAN segregation / VLAN. | Talk to the network admin — Wi-Fi clients must reach the server's LAN IP on TCP 80 and 3001. |
| Disk full | Postgres data growth + Docker build cache. | `docker system prune -af --volumes` (CAREFUL — preserves named volumes only). Move `pgdata` to a larger disk if needed. |
| Forgotten platform-admin password | Direct DB reset. | Use the password-reset CLI: `docker compose ... exec api node dist/scripts/reset-password.js <email>`. |

For unresolved issues, capture the following and email **support@3bsolutions.co.ug**:

```bash
docker compose -f docker-compose.offline.yml ps                  > diag.txt
docker compose -f docker-compose.offline.yml logs --tail 500 api >> diag.txt
docker compose -f docker-compose.offline.yml logs --tail 500 db  >> diag.txt
uname -a >> diag.txt; docker --version >> diag.txt
```

---

## 14. Hybrid / Sync Considerations (Roadmap)

Some institutions will run AMIS **offline as the system of record** and periodically push a sanitized export to a cloud node for ministry reporting or alumni portals. This is supported through:

1. **Daily DB dumps** (§10.1) shipped over a USB or scheduled rsync when internet is briefly available.
2. **Tenant-scoped JSON exports** from the platform-admin UI (Settings → Export).
3. A future **delta sync** worker (see [docs/SYNC-CONFLICT-RULES.md](docs/SYNC-CONFLICT-RULES.md)) — not required for first install.

If your VTI plans to use sync, contact 3B Solutions Ltd. before installation so the cloud counterpart can be provisioned with matching tenant IDs.

---

## 15. Support & Escalation

| Channel | Use for |
|---------|---------|
| **support@3bsolutions.co.ug** | All technical issues, bug reports, feature requests. |
| Phone (during business hours) | Critical outages, install-day blockers. |
| GitHub Issues (if private access granted) | Engineering follow-up. |

When raising a ticket, include:

* AMIS version (footer of UI, or `docker images | grep amis`).
* Server OS + Docker version.
* Last 500 lines of `api` and `db` logs.
* Whether the system is **offline** or **cloud** mode.
* Steps to reproduce.

---

## 16. Appendix A — File Reference

| File | Purpose |
|------|---------|
| `docker-compose.offline.yml` | Compose file for LAN / on-prem deployment. |
| `docker-compose.prod.yml` | Compose file for cloud / VPS deployment. |
| `.env.offline.example` | Template for offline environment variables. |
| `.env.prod.example` | Template for cloud environment variables. |
| `db/migrations/` | All sequential SQL migrations (managed by dbmate). |
| `db/data-migration/<institution>/` | Institution-specific seed scripts. |
| `nginx/amis.conf` | Nginx reverse-proxy template (cloud mode). |
| `scripts/build-offline-bundle.ps1` | (Vendor-side) creates the offline bundle. |
| [DEPLOY.md](DEPLOY.md) | Cloud-mode deployment runbook. |
| [USER_MANUAL.md](USER_MANUAL.md) | End-user guide. |
| [SECURITY.md](SECURITY.md) | Vendor security policy. |

## 17. Appendix B — Default Ports Summary

| Port | Bound on | Purpose | Open to LAN? | Open to Internet? |
|------|----------|---------|---------------|-------------------|
| 80 | host (offline) / 127.0.0.1 (cloud) | Web UI | Yes (offline) | Only via Nginx + TLS (cloud) |
| 3001 | host (offline) / 127.0.0.1 (cloud) | REST API | Yes (offline) | Only via Nginx (cloud) |
| 5432 | docker network only | PostgreSQL | **No** | **No** |
| 443 | host (cloud only) | Nginx HTTPS | — | Yes (cloud only) |

---

**End of Manual** — © 2026 3B Solutions Ltd. Distributed under the AMIS licensing terms agreed with the institution.
