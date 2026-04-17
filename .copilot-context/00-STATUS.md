# AMIS Rebuild — Current Status
_Last board sync: 2026-04-19_

## Phase 1 (Foundation) — COMPLETE ✅

## Phase 2 (Pilot Modules) — COMPLETE ✅ (134/134 tests, 12 test files)

## Wave 2 — COMPLETE ✅ (GH issues #13–#16 all closed)
- [x] #13 Fees CSV bulk import — frontend UI ✅
- [x] #14 Student deactivation / soft-delete ✅
- [x] #15 Dashboard workflow state breakdown ✅
- [x] #16 MarksListPage term filter (constrain to valid values) ✅

## Phase 3 Progress — IN PROGRESS 🔄 (356/356 tests, 27 migrations, 26 test files)

### Track A — Authentication — COMPLETE ✅

- [x] Prompt 16 — Users + roles DB tables + password hashing ✅ (160/160 tests)
- [x] Prompt 17 — POST /auth/login (JWT) + GET /auth/me ✅ (180/180 tests)
- [x] Prompt 18 — requireAuth JWT middleware + dual-mode identity ✅ (195/195 tests)
- [x] Prompt 19 — User management API (tenant admin) ✅ (226/226 tests)
- [x] Prompt 20 — Login page + auth flow (web) ✅ (226/226 tests — web only, no new API tests)

### Wave 3 Feature Epics — IN PROGRESS

- [x] **Epic E — Staff/HR module** (SR-F-017, 018, 019) ✅ — `app.staff` + contracts + appraisals, GET/POST/PATCH /staff, StaffListPage + StaffDetailPage (commit `20019bb`)
- [x] **Epic G — Reporting/Evaluations** (SR-F-031, 032, 033) ✅ — IT reports, teacher evaluations, instructor reports; migration, API routes, 3 web pages, tests (commit `cad7e66`, issue #8 closed)
- [x] **Nav persistence fix** — NavigationEditor "Save & Publish" button; re-seeded nav for all roles/tenants (commit `fe9343d`)
- [x] **Epic F gaps** — Marks audit view (SR-F-022) ✅, industrial training module (SR-F-023) ✅, field placement tracking (SR-F-026) ✅, term analytics (SR-F-027) ✅ — all already fully built (confirmed via audit)
- [x] **Epic A gaps** (SR-F-002, SR-F-003, SR-F-007) ✅ — Guardian/NOK fields on students (migration + API + web), dropout tracking with modal (deactivation body + dropout_reason/date/notes), fees analytics in TermAnalytics (total_due/collected/outstanding/students_with_arrears) (commit pending)

### Track B — Deployment — NOT STARTED

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

## Wave 3 — BACKLOG 🔲 (Next up)

### Wave 3 — Feature Gaps (from Epic board sync)
- [x] **#12 Programme catalog** (SR-F-012, Epic C) ✅ — `app.programmes` table, FK migration on students/admissions, GET/POST/PATCH/DELETE /programmes, ProgrammesListPage + ProgrammeDetailPage, catalogue dropdown in student + admissions forms (272/272 tests)
- [ ] **Epic E — Staff/HR module** (SR-F-017/018/019) — Not started. HR profiles, contracts, appraisals, instructor attendance, staff status
- [x] **Epic F gaps** — Marks audit view (SR-F-022) ✅, industrial training (SR-F-023) ✅, field placement (SR-F-026) ✅, term analytics (SR-F-027) ✅
- [x] **Epic A gaps** — Guardian/next-of-kin fields (SR-F-002) ✅, dropout tracking (SR-F-003) ✅, fees summary (SR-F-007) ✅

### Wave 3 — Phase 3 Track B Deployment
- [ ] Prompt 21 — Supabase Postgres setup + migrations
- [ ] Prompt 22 — Render deployment (API + Web)
- [ ] Prompt 23 — CI/CD (GitHub Actions → Render auto-deploy)
- [ ] Prompt 24 — Offline Docker Compose build (UTC Kyema)

### Wave 3 — Phase 3 Track C Data Migration (UTC Kyema)
- [ ] Prompt 25 — Audit UTC Kyema data (Excel/CSV analysis)
- [ ] Prompt 26 — Migration scripts (CSV → AMIS format)
- [ ] Prompt 27 — Dry-run + validation report
- [ ] Prompt 28 — Production migration + verification

### Wave 3 — Phase 3 Track D Production Hardening
- [ ] Prompt 29 — Module toggle enforcement (API + Web)
- [ ] Prompt 30 — Route param UUID validation
- [ ] Prompt 31 — Error handling + structured logging
- [ ] Prompt 32 — Rate limiting + security headers

## Epic Board Sync (Wave 1-2 closing state)

| Epic | Key Items | Done | Partial | Not built |
|------|-----------|------|---------|-----------|
| A — Student Registry | SR-F-001, 002, 003, 006, 007 | ✅ | SR-F-004, 008 | SR-F-005, 011 |
| B — Admissions | SR-F-010, 028, 029, 030 | ✅ all | — | — |
| C — Programmes | SR-F-012 | ✅ built | — | — |
| D — Fees & Finance | SR-F-013, 015 | ✅ | SR-F-016 | SR-F-014 (Wave 4) |
| E — Staff/HR | SR-F-017, 018, 019 | ✅ all | — | — |
| F — Marks | SR-F-020, 021, 022, 023, 024, 026, 027 | ✅ all | — | — |
| G — Reporting/Evals | SR-F-031, 032, 033 | ✅ all | — | — |
| NF | SR-NF-001, 002, 004 | ✅ | SR-NF-003 (no perf tests) | — |

---

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
