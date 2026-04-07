# AMIS Rebuild — Current Status

## Phase 1 (Foundation) — COMPLETE ✅

- Monorepo scaffold (apps/api + apps/web)
- dbmate migrations + platform/app schemas + RLS
- Tenant context middleware (x-tenant-id header, dev-mode)
- Seed data + RLS isolation proof test
- Config versioning (draft → validate → publish → rollback)
- Workflow engine skeleton + Admissions workflow example
- Web dev tenant switch + students list/create UI

## Phase 2 (Pilot Modules) — COMPLETE ✅

- [x] Prompt 8 — Dev Identity + RBAC scaffolding ✅ (50/50 tests)
- [x] Prompt 9 — UI Config schema + config-driven AppShell ✅ (55/55 tests)
- [x] Prompt 10 — Student Management v1 ✅ (64/64 tests)
- [x] Prompt 11 — Workflow Engine enhancements ✅ (71/71 tests)
- [x] Prompt 12 — Admissions v1 + TVET import ✅ (92/92 tests)
- [x] Prompt 13 — Marks v1 + immutable audit ✅ (113/113 tests)
- [x] Prompt 14 — Fees v1 + role-gated access ✅ (134/134 tests)
- [x] Prompt 15 — Admin Studio UI ✅ (134/134 tests, UI only)

## What Prompt 15 delivered (reference)

New API endpoints (added to config.routes.ts):

- GET /config/status → { published, draft } (powers all 4 admin screens)
- GET /config/audit?limit=N → last N audit log entries

Web (apps/web/src/admin-studio/):

- admin-studio.api.ts: typed wrappers for all config API calls
- AdminStudioLayout.tsx: dark sidebar layout; non-admin → redirect to /
- ConfigDashboard.tsx: published version info + draft status +
  last 5 audit entries
- ConfigEditor.tsx: JSON textarea + Save Draft + Validate (inline) +
  Publish/Rollback (confirm dialogs) +
  queryClient.invalidateQueries(["config"]) after each write
- WorkflowViewer.tsx: workflow keys from config + state badges +
  transitions table
- NavigationEditor.tsx: per-role nav list + add/remove/reorder +
  saves as draft
- Route: /admin-studio/\* is top-level (separate from AppShell)

Also fixed:

- ConfigProvider.tsx: duplicate-body corruption causing TS compile error
- StudentsListPage.tsx: same duplicate-body issue

## Full module inventory (Phase 2)

### API modules (apps/api/src/modules/)

| Module     | Endpoints                                     | Tests |
| ---------- | --------------------------------------------- | ----- |
| config     | GET/POST draft/validate/publish/rollback/     |       |
|            | status/audit                                  |       |
| workflow   | GET instance, GET definition, POST transition |       |
| students   | GET list, GET/:id, POST, PUT                  | 15+3  |
| admissions | POST app, GET list, GET/:id,                  |       |
|            | POST import, POST import/:id/confirm          | 18+3  |
| marks      | POST submission, PUT entries, GET list,       |       |
|            | GET/:id                                       | 18+3  |
| fees       | GET summary, GET transactions,                |       |
|            | POST entry, POST import, POST webhook stub    | 18+3  |

### Web features (apps/web/src/)

| Feature      | Pages                                          |
| ------------ | ---------------------------------------------- |
| app shell    | AppShell, ConfigProvider, DevRoleSwitcher,     |
|              | DevTenantSwitcher                              |
| students     | StudentsListPage, StudentDetailPage,           |
|              | StudentCreatePage                              |
| admissions   | (list + detail + import UI)                    |
| marks        | (list + detail + entry UI)                     |
| fees         | (summary + transactions + entry UI)            |
| admin-studio | ConfigDashboard, ConfigEditor, WorkflowViewer, |
|              | NavigationEditor                               |

### DB tables (app schema, all with RLS)

| Table                    | Audit pattern                   |
| ------------------------ | ------------------------------- |
| students                 | updated_at                      |
| admission_applications   | workflow_events                 |
| admission_import_batches | status field                    |
| mark_submissions         | workflow_events                 |
| mark_entries             | mark_audit_log                  |
| mark_audit_log           | append-only (INSERT+SELECT RLS) |
| payments                 | fee_audit_log                   |
| fee_audit_log            | append-only (INSERT+SELECT RLS) |

## Architecture rules (must follow always)

- Every business table: tenant_id uuid not null + RLS enabled
- Every DB transaction: SET LOCAL app.tenant_id = $1 (tenantTx)
- Workflow engine = ONLY source of entity state (no status columns)
- Entity state from workflow_instances.current_state (JOIN; never a column)
- Audit log tables: INSERT+SELECT RLS only (no UPDATE/DELETE)
- Config versioned: draft → validate → publish → rollback
- No tenant scripts or custom code execution

## Dev identity pattern (active until real auth)

- x-tenant-id → tenantId
- x-dev-role → role (default: admin; set via DevRoleSwitcher)
- x-dev-user-id → userId (deterministic UUID by role)
- request.user = { tenantId, role, userId }
- requireRole(...roles) used as preHandler on ALL protected routes

## Deterministic dev user IDs

- admin → 00000000-0000-0000-0000-000000000001
- registrar → 00000000-0000-0000-0000-000000000002
- hod → 00000000-0000-0000-0000-000000000003
- instructor → 00000000-0000-0000-0000-000000000004
- finance → 00000000-0000-0000-0000-000000000005
- principal → 00000000-0000-0000-0000-000000000006

## UUID test data rule

All test UUIDs must use hex chars only (0-9, a-f).
NEVER: stud0000-, user0000-, test0000- (s,t,u are not hex)
USE: ab000000-0000-0000-0000-000000000001 pattern

## Phase 3 — Post-Phase-2 Backlog (next planning session)

- [ ] Real JWT auth (replace x-dev-role/x-dev-user-id headers)
- [ ] Module toggle enforcement (API middleware + web nav hiding)
- [ ] Per-VTI fee structures (programme/cohort level, not just defaultTotalDue)
- [ ] SchoolPay webhook (POST /webhooks/schoolpay — currently 501 stub)
- [ ] Admissions UI (list + detail + import pages — web only)
- [ ] Marks UI (entry form + workflow actions — web only)
- [ ] Fees UI (summary + transactions + entry — web only)
- [ ] Offline sync queue (IndexedDB + BullMQ replay)
- [ ] Procurement module (UTC Kyema — optional module pattern)
- [ ] GitHub repo creation + CI/CD pipeline (pnpm test + dbmate up)
- [ ] First VTI pilot deployment (Docker + managed Postgres)
