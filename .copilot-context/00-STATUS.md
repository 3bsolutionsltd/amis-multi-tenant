# AMIS Rebuild — Current Status

## Phase 1 (Foundation) — COMPLETE ✅

## Phase 2 (Pilot Modules) — COMPLETE ✅ (134/134 tests, 12 test files)

## Phase 3 Progress — IN PROGRESS 🔄 (226/226 tests, 17 test files)

## Phase 3 (Auth + Deployment + Migration) — PLANNING 🔄

### Track A — Authentication

- [x] Prompt 16 — Users + roles DB tables + password hashing ✅ (160/160 tests)
- [x] Prompt 17 — POST /auth/login (JWT) + GET /auth/me ✅ (180/180 tests)
- [x] Prompt 18 — requireAuth JWT middleware + dual-mode identity ✅ (195/195 tests)
- [x] Prompt 19 — User management API (tenant admin) ✅ (226/226 tests)
- [x] Prompt 20 — Login page + auth flow (web) ✅ (226/226 tests — web only, no new API tests)

### Track B — Deployment

- [ ] Prompt 21 — Supabase Postgres setup + migrations
- [ ] Prompt 22 — Render deployment (API + Web)
- [ ] Prompt 23 — CI/CD (GitHub Actions → Render auto-deploy)
- [ ] Prompt 24 — Offline Docker Compose build (UTC Kyema)

### Track C — Data Migration (UTC Kyema)

- [ ] Prompt 25 — Audit UTC Kyema data (Excel/CSV analysis)
- [ ] Prompt 26 — Migration scripts (CSV → AMIS format)
- [ ] Prompt 27 — Dry-run + validation report
- [ ] Prompt 28 — Production migration + verification

### Track D — Production Hardening

- [ ] Prompt 29 — Module toggle enforcement (API + Web)
- [ ] Prompt 30 — Route param UUID validation
- [ ] Prompt 31 — Error handling + structured logging
- [ ] Prompt 32 — Rate limiting + security headers

## Confirmed Phase 3 decisions

- Auth: Custom JWT (fastify-jwt)
  - JWT payload: { sub: userId, tenantId, role }
  - Dev headers kept behind NODE_ENV=development only
- Demo/Testing: Supabase (Postgres) + Render (API + Web)
- Production/Offline: Docker Compose (UTC Kyema local server)
- First pilot: UTC Kyema — all 4 modules live, real data migration

## Prerequisites before Prompt 16

- [ ] Supabase project created (save DB URL + keys)
- [ ] Render account created (linked to GitHub)
- [ ] UTC Kyema sample data received (Excel/CSV per module)
- [ ] GitHub repo pushed (3bsolutionsltd/amis-multi-tenant)

## Phase 2 backlog (carry into Phase 3)

- [ ] Route param UUID validation on :id params (all modules)
- [ ] Module toggle enforcement (API middleware + web nav)
- [ ] SchoolPay webhook (currently 501 stub)
- [ ] Per-VTI fee structures (programme/cohort level)
- [ ] Offline sync queue (IndexedDB + BullMQ — post-pilot)

## Architecture rules (unchanged)

- Every business table: tenant_id uuid not null + RLS enabled
- Every DB transaction: SET LOCAL app.tenant_id = $1 (tenantTx)
- Workflow engine = ONLY source of entity state (no status columns)
- Config versioned: draft → validate → publish → rollback
- No tenant scripts or custom code execution

## JWT auth pattern (from Prompt 18 onward)

- Authorization: Bearer <token>
- JWT payload: { sub: userId, tenantId, role, iat, exp }
- request.user = { tenantId, role, userId } (same shape as devIdentity)
- requireRole(...roles) unchanged — reads from request.user
- Dev mode only: x-dev-role / x-dev-user-id headers still accepted
  when NODE_ENV=development

## Deterministic dev user IDs (dev mode only)

- admin → 00000000-0000-0000-0000-000000000001
- registrar → 00000000-0000-0000-0000-000000000002
- hod → 00000000-0000-0000-0000-000000000003
- instructor → 00000000-0000-0000-0000-000000000004
- finance → 00000000-0000-0000-0000-000000000005
- principal → 00000000-0000-0000-0000-000000000006
- dean → 00000000-0000-0000-0000-000000000007

Tenant B prefix uses `...00000000001{1-7}` (e.g. `00000000-0000-0000-0000-000000000011`)

## UUID test data rule

All test UUIDs: hex chars only (0-9, a-f)
USE: ab000000-0000-0000-0000-000000000001
NEVER: stud0000-, user0000-, test0000-
