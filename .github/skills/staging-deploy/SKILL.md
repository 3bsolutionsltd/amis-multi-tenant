---
name: staging-deploy
description: "Deploy latest code to the AMIS staging server (pre.amis.institute). Use when: deploying PRs to staging, rebuilding staging containers, applying new migrations, reflecting merged PRs on the VPS, staging is running old code, need to update pre.amis.institute after a merge, rebuild web or api container on staging."
argument-hint: "Optional: what was changed, e.g. 'api fix only' or 'frontend + migration'"
---

# Staging Deploy

Standard procedure for deploying the latest `main` branch to the AMIS staging VPS at `pre.amis.institute`.

## When to Use

- One or more PRs have been merged to `main` and staging needs to reflect them
- The staging server is running old code
- A new DB migration was added
- Frontend or API code changed and containers need rebuilding
- After any `git push` to `main` that affects `apps/api`, `apps/web`, or `db/migrations`

---

## Phase 1 — Clarify Scope

Before deploying, check what changed since the last deploy to decide which containers need rebuilding.

Ask the user (via `vscode_askQuestions`) **only if not already clear**:

| Question | Why |
|----------|-----|
| Which containers changed? | Avoid unnecessary `--no-cache` builds |
| Are there new migrations? | Must run `migrate` service before restarting API |

**Auto-detect** by checking:
- `apps/api/src/**` changed → rebuild `api`
- `apps/web/src/**` changed → rebuild `web`
- `db/migrations/*.sql` added → run `migrate`
- `docker-compose.staging.yml` changed → `up -d` all services to apply config

---

## Phase 2 — SSH onto Staging & Pull

Tell the user to run these commands on the staging VPS (`/opt/amis`):

```bash
cd /opt/amis
git pull origin main
git log --oneline -5
```

**Verify**: The expected merge commits / tags should appear at the top. If `Already up to date` shows but the expected commits are missing, the server is on the wrong branch — fix with:

```bash
git fetch origin
git checkout main
git pull origin main
```

---

## Phase 3 — Run Migrations (if any new `.sql` files)

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging run --rm migrate
```

The `migrate` service uses `ghcr.io/amacneil/dbmate:latest` with `sslmode=disable` already configured. It is idempotent — safe to run even if no new migrations exist.

---

## Phase 4 — Rebuild Containers

**API changed:**
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging build --no-cache api
```

**Web changed:**
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging build --no-cache web
```

**Both changed:**
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging build --no-cache api web
```

> Always use `--no-cache` to prevent Docker from reusing a stale build layer from a previous run on the same checkout.

---

## Phase 5 — Start / Restart All Services

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging up -d
```

This starts new containers, applies any `docker-compose.staging.yml` config changes (e.g. healthcheck updates), and leaves unchanged containers running.

---

## Phase 6 — Verify

```bash
# All containers should show "Up" and "healthy"
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging ps

# Spot-check API is responding
curl -s https://api.pre.amis.institute/health

# Confirm the fix is compiled into the running image (example for a specific symbol)
docker exec amis-staging-api-1 grep -c "superPool" dist/modules/onboarding/onboarding.routes.js
```

---

## Quick Reference — Full Deploy (all changed)

```bash
cd /opt/amis
git pull origin main
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging run --rm migrate
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging build --no-cache api web
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging up -d
docker compose -f docker-compose.staging.yml --env-file .env.staging --project-name amis-staging ps
```

---

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Already up to date` but commits missing | Server on wrong branch | `git checkout main && git pull` |
| 500 error after rebuild | Old Docker cache served stale code | Use `--no-cache` on build |
| Route not found in browser | Web container not rebuilt | Rebuild web, hard-reload browser (Ctrl+Shift+R) |
| `SSL is not enabled on the server` | Running `npx dbmate` inside container | Use the `migrate` service (`run --rm migrate`) |
| Containers unhealthy after `up -d` | Build failed silently | Check `docker logs amis-staging-api-1 --tail 30` |
