# AMIS Deployment Workflow — Windows PowerShell Reference

This document is the definitive guide for deploying changes from your Windows development
machine to the AMIS staging and production environments.

---

## Quick Reference — Key Facts

| Item | Value |
|---|---|
| VPS IP | `vmi3230381` (use hostname or IP as configured in your `~/.ssh/config`) |
| App directory on VPS | `/opt/amis` |
| Staging URL | `https://pre.amis.institute` / `https://api.pre.amis.institute` |
| Production URL | `https://amis.institute` / `https://api.amis.institute` |
| Staging compose file | `docker-compose.staging.yml` |
| Production compose file | `docker-compose.prod.yml` |
| Staging project name | `amis-staging` |
| Staging env file | `.env.staging` (**always required** — never omit `--env-file .env.staging`) |
| GitHub repo | `https://github.com/3bsolutionsltd/amis-multi-tenant` |

---

## Part 0 — Local Commit & Push (Always First)

Before touching the VPS, always commit and push your changes from Windows PowerShell.

```powershell
cd C:\Users\DELL\amis-multi-tenant

# Create a feature branch (never commit directly to main)
git checkout -b feat/short-description

# Stage your changes
git add -A

# Commit with a conventional commit message
git commit -m "feat: short description of what changed"

# Push the branch to GitHub
git push origin feat/short-description
```

> **Then open a Pull Request** on GitHub from your branch into `main`.
> Branch protection on `main` requires:
> - At least **1 approved review** before merging
> - The **CI pipeline (test job)** must pass
>
> Direct pushes to `main` are blocked. Use `git push origin main` **only** in hotfix emergencies
> agreed by the team, using a short-lived branch merged via PR.

> **Tip:** If you only changed specific files, use `git add <file>` instead of `git add -A`.
> But `git add -A` is safe — it stages all changes and new files.

---

## Part 1 — Determine Your Scenario

After committing and pushing, identify what type of changes you made:

| Scenario | What Changed | Go To |
|---|---|---|
| **A** | TypeScript / React code only (no migrations, no Dockerfile, no new env vars) | [Scenario A](#scenario-a--code-only-changes) |
| **B** | Code + one or more new `.sql` files in `db/migrations/` | [Scenario B](#scenario-b--code--new-db-migrations) |
| **C** | `apps/api/Dockerfile` or `apps/web/Dockerfile` changed | [Scenario C](#scenario-c--dockerfile-changes) |
| **D** | New environment variable added to `.env.*.example` | [Scenario D](#scenario-d--new-environment-variable) |
| **E** | `nginx/amis.conf` or `nginx/amis-staging.conf` changed | [Scenario E](#scenario-e--nginx-config-changes) |
| **F** | Multiple of the above combined | Do each relevant section in order: B → D → E → A/C |

If you are unsure, check what files changed:

```powershell
git -C C:\Users\DELL\amis-multi-tenant diff --stat HEAD~1 HEAD
```

---

## Part 2 — Connect to the VPS

Open Windows PowerShell and SSH in:

```powershell
ssh root@vmi3230381
```

Once connected, navigate to the app directory:

```bash
cd /opt/amis
```

**All VPS commands below assume you are already in `/opt/amis`.**

---

## Scenario A — Code-Only Changes

_No new SQL migrations. No Dockerfile changes. No new env vars. Just TypeScript/React/config edits._

### Deploy to Staging

```bash
git pull origin main

docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  up -d --build
```

### Verify Staging

```bash
curl -s https://api.pre.amis.institute/health
# Expected: {"status":"ok"}
```

### Deploy to Production (after staging is confirmed good)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Verify Production

```bash
curl -s https://api.amis.institute/health
# Expected: {"status":"ok"}
```

---

## Scenario B — Code + New DB Migrations

_You added one or more `.sql` files under `db/migrations/`._

> **Rule:** Always run migrations **before** rebuilding/restarting the API.
> The migration service is idempotent — safe to run multiple times.

### Deploy to Staging

```bash
git pull origin main

# 1. Run migrations first
docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  run --rm migrate

# 2. Rebuild and restart
docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  up -d --build
```

### Verify Staging Migrations Applied

```bash
docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  run --rm migrate status
```

### Verify Staging API

```bash
curl -s https://api.pre.amis.institute/health
# Expected: {"status":"ok"}
```

### Deploy to Production (after staging is confirmed good)

```bash
# 1. Run migrations first
docker compose -f docker-compose.prod.yml run --rm migrate

# 2. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

### Verify Production

```bash
curl -s https://api.amis.institute/health
```

---

## Scenario C — Dockerfile Changes

_You edited `apps/api/Dockerfile` or `apps/web/Dockerfile`._

The commands are the same as Scenario A, but Docker will automatically detect the Dockerfile
change and rebuild from scratch (not using cache). No extra steps needed.

If you want to force a completely clean rebuild (no cache at all):

```bash
# Staging — no-cache rebuild
docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  build --no-cache

docker compose -f docker-compose.staging.yml \
  --project-name amis-staging \
  --env-file .env.staging \
  up -d

# Production — no-cache rebuild
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

> **When is `--no-cache` needed?** Only when you change a base image version in the FROM
> line, or when you suspect a stale layer is causing issues. Normal Dockerfile edits do not
> require it.

---

## Scenario D — New Environment Variable

_You added a new variable to `.env.staging.example` or `.env.prod.example`._

You must manually add the new variable to the actual `.env` files on the VPS **before**
rebuilding. The `.example` files are not used directly — they are templates only.

### On the VPS

```bash
# Edit staging env
nano .env.staging
# Add the new variable at the bottom, e.g.:
# NEW_VARIABLE=some-value

# Edit production env
nano .env
# Add the same variable with production-appropriate value
```

Then proceed with the normal rebuild (Scenario A or B as applicable).

### Verify the env var made it into the container

```bash
# Staging
docker inspect amis-staging-api-1 | grep NEW_VARIABLE

# Production
docker inspect amis-api-1 | grep NEW_VARIABLE
```

---

## Scenario E — Nginx Config Changes

_You edited `nginx/amis.conf` or `nginx/amis-staging.conf`._

Nginx runs natively on the VPS (not in Docker), so config changes require a manual copy and reload.

```bash
# Staging Nginx config
cp /opt/amis/nginx/amis-staging.conf /etc/nginx/sites-available/amis-staging.conf

# Production Nginx config
cp /opt/amis/nginx/amis.conf /etc/nginx/sites-available/amis.conf

# Test config syntax
nginx -t

# Apply changes (only if nginx -t passed)
systemctl reload nginx
```

> Do **not** run `systemctl restart nginx` — use `reload`. Restart briefly drops all
> connections; reload is zero-downtime.

---

## Part 3 — Staging vs Production Decision Flow

```
Make local changes
       ↓
Commit & push to GitHub  (Part 0)
       ↓
Deploy to STAGING first  (pre.amis.institute)
       ↓
Test manually on staging
       ↓
Confirmed working?
   YES → Deploy to PRODUCTION  (amis.institute)
   NO  → Fix locally, re-commit, re-deploy staging
```

**Never deploy directly to production without first validating on staging.**

---

## Part 4 — Full Redeployment Commands (Copy-Paste Ready)

These are the complete one-liner sequences for each environment. Copy and run on the VPS.

### Staging — Code only (no new migrations)

```bash
cd /opt/amis && git pull origin main && \
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging up -d --build
```

### Staging — With new migrations

```bash
cd /opt/amis && git pull origin main && \
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging run --rm migrate && \
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging up -d --build
```

### Production — Code only (no new migrations)

```bash
cd /opt/amis && git pull origin main && \
docker compose -f docker-compose.prod.yml up -d --build
```

### Production — With new migrations

```bash
cd /opt/amis && git pull origin main && \
docker compose -f docker-compose.prod.yml run --rm migrate && \
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Part 5 — Checking Status & Logs

### Container status

```bash
# Staging
docker compose -f docker-compose.staging.yml --project-name amis-staging ps

# Production
docker compose -f docker-compose.prod.yml ps
```

All services should show `running`. The `migrate` service will show `exited (0)` — that is correct.

### Live logs

```bash
# Staging API logs
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging logs -f api

# Production API logs
docker compose -f docker-compose.prod.yml logs -f api

# Web frontend logs (usually less useful — mainly Nginx access logs)
docker compose -f docker-compose.prod.yml logs -f web

# Press Ctrl+C to stop following
```

### Health checks

```bash
curl -s https://api.pre.amis.institute/health    # Staging
curl -s https://api.amis.institute/health        # Production
# Expected: {"status":"ok"}
```

---

## Part 6 — Rollback Procedure

### Rollback to a previous commit

```bash
cd /opt/amis

# List recent commits to find the good one
git log --oneline -10

# Reset to the previous good commit (replace <hash> with actual commit hash)
git checkout <hash> .

# Rebuild with the rolled-back code
docker compose -f docker-compose.prod.yml up -d --build
```

> If the bad deployment also ran a DB migration, the rollback **will not undo the migration**.
> You would need to manually revert the schema change via psql. Avoid this by always testing
> on staging first.

### Quick restart (no rebuild — useful for transient crashes)

```bash
# Staging
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging restart api

# Production
docker compose -f docker-compose.prod.yml restart api
```

---

## Part 7 — Database Access

### Open a psql shell

```bash
# Staging database
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging \
  exec db psql -U amis amis_staging

# Production database
docker compose -f docker-compose.prod.yml exec db psql -U amis amis
```

### Check migration status

```bash
# Staging
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging \
  run --rm migrate status

# Production
docker compose -f docker-compose.prod.yml run --rm migrate status
```

---

## Part 8 — Troubleshooting Common Problems

### API container keeps restarting / crash-looping

```bash
# Check the logs for the actual error
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging logs api

# Common causes:
# - Missing env variable → add to .env.staging, rebuild
# - DB connection failure → check DB container is up, check POSTGRES_PASSWORD matches
# - Port already in use → check for conflicting processes: ss -tlnp | grep 3002
# - File permission error in uploads/ → see below
```

### Uploads directory permission error (`EACCES /app/apps/api/uploads`)

The API runs as `USER node`. If the uploads volume was created by root, access is denied.

```bash
# Fix by chowning the named volume's data
docker run --rm \
  -v amis-staging_uploads_staging:/data \
  alpine chown -R 1000:1000 /data

# Then restart
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging restart api
```

### Wrong CORS_ORIGIN in staging container (staging uses prod secrets)

This happens when `--env-file .env.staging` was omitted from the `up` command.

```bash
# Verify what's currently in the container
docker inspect amis-staging-api-1 | grep CORS_ORIGIN
# If it shows amis.institute instead of pre.amis.institute:

# Bring it down and bring it back up WITH --env-file
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging down
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging up -d --build
```

### Migration fails with "relation already exists"

This is usually safe — dbmate is idempotent and tracks which migrations have run.
Check the output carefully; if it only prints already-applied migrations and exits 0, you are fine.

If a migration genuinely fails mid-way, check the error message and fix the SQL in the migration file, then run migrate again.

### Docker image build fails (TypeScript compile error)

```bash
# Check the build output
docker compose -f docker-compose.staging.yml --project-name amis-staging --env-file .env.staging build api 2>&1 | tail -50
```

Fix the TypeScript error locally, commit, push, then redeploy.

### Nginx 502 Bad Gateway

The Nginx reverse proxy cannot reach the upstream container.

```bash
# 1. Check the container is actually running
docker ps | grep api

# 2. Check the port is bound
ss -tlnp | grep 3001   # production
ss -tlnp | grep 3002   # staging

# 3. Check Nginx upstream config matches the port
cat /etc/nginx/sites-available/amis.conf | grep proxy_pass

# 4. Check Nginx error log
tail -50 /var/log/nginx/error.log
```

---

## Part 9 — Complete Local → Staging → Production Workflow (Step by Step)

This is the full end-to-end checklist for any change:

```
[ ] 1. Make and test changes locally
[ ] 2. Run local TypeScript check (in VSCode or: npx tsc --noEmit)
[ ] 3. git add -A
[ ] 4. git commit -m "meaningful message"
[ ] 5. git push origin main
[ ] 6. SSH into VPS: ssh root@vmi3230381
[ ] 7. cd /opt/amis
[ ] 8. git pull origin main
[ ] 9. (If new migrations) run migrate on STAGING
[ ] 10. Rebuild and restart STAGING
[ ] 11. Verify: curl -s https://api.pre.amis.institute/health
[ ] 12. Open https://pre.amis.institute and manually test the changes
[ ] 13. (If new migrations) run migrate on PRODUCTION
[ ] 14. Rebuild and restart PRODUCTION
[ ] 15. Verify: curl -s https://api.amis.institute/health
[ ] 16. Spot-check production
```

---

## Part 10 — Environment File Quick Reference

| File | Used by | Contains |
|---|---|---|
| `.env` | `docker-compose.prod.yml` | Production secrets |
| `.env.staging` | `docker-compose.staging.yml` (requires `--env-file .env.staging`) | Staging secrets |
| `.env.prod.example` | Reference only | Template — do not use directly |
| `.env.staging.example` | Reference only | Template — do not use directly |

**Critical rule:** The staging compose file does NOT auto-load `.env.staging`.
Docker Compose always defaults to `.env`. You MUST always pass `--env-file .env.staging`
on every staging command or you will be running staging containers with production secrets.
