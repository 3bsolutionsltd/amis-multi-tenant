# Execution Prompts — Phase 2 (Run in Order, 8–15)

## Context (read first)
- Single workflow engine handles ALL module lifecycles.
- Entity state = workflow_instances.current_state (no module status columns).
- Dev identity via headers: x-tenant-id, x-dev-role, x-dev-user-id.
- Config is versioned; UI config drives AppShell + forms.
- All DB access runs inside tenantTx (SET LOCAL app.tenant_id).

---

## Prompt 8 — Dev Identity + RBAC scaffolding (dev-mode)

In apps/api, add a dev-only identity layer:

1) Request context:
   - request.user = { tenantId: string, role: string, userId: string }

2) Middleware reads headers:
   - x-tenant-id → tenantId (keep existing)
   - x-dev-role → role (default: 'admin' if missing)
   - x-dev-user-id → userId
     - If missing, assign deterministic UUID by role, e.g.:
       admin      -> 00000000-0000-0000-0000-000000000001
       registrar  -> 00000000-0000-0000-0000-000000000002
       hod        -> 00000000-0000-0000-0000-000000000003
       instructor -> 00000000-0000-0000-0000-000000000004
       finance    -> 00000000-0000-0000-0000-000000000005
       principal  -> 00000000-0000-0000-0000-000000000006
     - If role unknown, default to admin uuid.

3) Add helper: requireRole(...roles: string[])
   - Throws 403 if request.user.role not in roles
   - Use as a Fastify preHandler hook

4) Update workflow endpoints:
   - Store actor_user_id from request.user.userId on events

Tests:
- request.user is always populated
- requireRole blocks correctly
- workflow transition stores actor_user_id

Exit criteria:
- Every request has tenantId + role + userId on request.user
- Routes can call requireRole('registrar', 'admin') as preHandler
- Workflow transitions record actor_user_id deterministically

---

## Prompt 9 — UI Config schema + config-driven AppShell (web)

API:
1) Extend config Zod schema to include OPTIONAL UI config sections with defaults:
   - branding: { appName: string, logoUrl?: string } (default appName='AMIS')
   - theme: { primaryColor: string } (default '#2563EB')
   - navigation: Record<role, Array<{ label: string, route: string }>> (default {})
   - dashboards: Record<role, Array<{ type: 'KPI'|'ACTION', label: string, metricKey?: string, route?: string }>> (default {})

2) Seed/update example tenant published configs to include UI config sections.

Web:
1) Add DevTenantSwitcher (localStorage, sends x-tenant-id header)
2) Add DevRoleSwitcher (localStorage, sends x-dev-role header)
3) Add ConfigProvider:
   - fetches GET /config via TanStack Query (cache 60s)
   - exposes config via context
4) Implement AppShell:
   - header title from branding.appName
   - sidebar from navigation[role] (fallback to a minimal default menu)
   - dashboard cards from dashboards[role] (fallback to empty)
   - apply CSS variable --primary-color from theme.primaryColor

Exit criteria:
- Switching tenant changes appName/theme/menu/dashboard
- Switching role changes visible navigation/dashboard
- Publishing new config changes UI after refresh (and after refetch if you choose)

---

## Prompt 10 — Student Management v1 (CRUD + config-aware form)

API (apps/api/src/modules/students):
Endpoints:
- GET /students (search, status filter, pagination)
- GET /students/:id
- POST /students (registrar/admin only)
- PUT /students/:id (registrar/admin only)

Rules:
- tenantTx on all queries
- students.extension jsonb default '{}' column (add if missing)
- Zod validate request bodies
- Dev RBAC: requireRole('registrar','admin') on write routes

Tests:
- CRUD success + 400/404
- RLS isolation (tenant A cannot read tenant B)
- Role check: 403 if wrong role

Web (apps/web/src/features/students):
- Students list (search + filter + pagination)
- Student detail page
- Create student form (React Hook Form + Zod)
- Form order/labels/visibility driven by config.forms.students if present
- Extension fields rendered if defined in config.forms.students.extensionFields

Exit criteria:
- Student CRUD works
- RLS isolation proven by test
- Form order/labels driven by config (even minimal)

---

## Prompt 11 — Workflow Engine enhancements

API additions:
1) GET /workflow/:entityType/:entityId?workflowKey=
   - Returns: { workflowKey, currentState }
   - 404 if instance missing

2) GET /workflows/:workflowKey
   - Returns workflow definition from published config payload

3) Improve transition validation (transition endpoint):
   - Verify workflowKey matches instance.workflow_key
   - Verify transition is allowed from currentState in definition
   - Store actor_user_id from request.user.userId

Exit criteria:
- UI can GET /workflows/admissions and render correct action buttons
- GET /workflow/admissions/:id returns current state
- Invalid transitions return 400 with reason
- actor_user_id stored on all transitions

---

## Prompt 12 — Admissions v1 (applications + TVET import + workflow)

API (apps/api/src/modules/admissions):
Tables (migrations):
- app.admission_applications (tenant_id, first_name, last_name, programme, intake, dob, gender, created_at, extension jsonb default '{}')
- app.admission_import_batches (tenant_id, filename, status, row_count, imported_by, created_at)

Endpoints:
- POST /admissions/applications
  - Creates application + initialises workflow instance (entityType=admissions, workflowKey=admissions)
  - Uses workflow definition initial_state (do not hardcode 'Draft')
- GET /admissions/applications
  - Joins workflow_instances for current_state
  - Filters: intake, programme, current_state (workflow-derived)
- GET /admissions/applications/:id
- POST /admissions/import
  - Parse CSV, validate rows, return preview (do not insert yet)
- POST /admissions/import/:batchId/confirm
  - Bulk insert valid rows as applications + init workflow for each

Dev RBAC:
- registrar/admin: all operations
- others: read only

Exit criteria:
- Application status comes from workflow_instances.current_state (not a column)
- Import preview + confirm works
- Workflow transitions work on applications (Submit/Review/Accept/Reject)

---

## Prompt 13 — Marks v1 (submission model + immutable audit)

API (apps/api/src/modules/marks):
Tables (migrations):
- app.mark_submissions (tenant_id, course_id, programme, intake, term, created_by, created_at, correction_of_submission_id nullable)
- app.mark_entries (tenant_id, submission_id, student_id, score, updated_by, updated_at)
- app.mark_audit_log (tenant_id, submission_id, entry_id, old_score, new_score, actor_user_id, changed_at) — append-only

Endpoints:
- POST /marks/submissions (instructor/admin; creates + inits workflow entityType=marks, workflowKey=marks)
- PUT /marks/submissions/:id/entries (upsert scores)
  - BLOCK if workflow state = PUBLISHED
  - Log every change to mark_audit_log
- GET /marks/submissions (filters: course/intake/term/state)
- GET /marks/submissions/:id (includes entries + workflow state)

Workflow states (machine-friendly):
- DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED
Corrections:
- Published submissions immutable
- Create new submission with correction_of_submission_id

Dev RBAC:
- instructor: create/update draft, submit
- hod: approve/return
- registrar/admin: publish
- principal: read

Exit criteria:
- Published submissions cannot be edited (server enforced, tested)
- Every entry change creates mark_audit_log row
- Workflow transitions record actor_user_id

---

## Prompt 14 — Fees v1 (role-gated visibility + manual entry + CSV import)

API (apps/api/src/modules/fees):
Tables (migrations):
- app.payments (tenant_id, student_id, amount, currency, reference, paid_at, source, imported_by, created_at)
- app.fee_audit_log (tenant_id, payment_id, action, actor_user_id, created_at) — append-only (writes/imports only)

Config:
- Add minimal fee due configuration to config payload to compute balance, e.g.:
  - payload.fees.defaultTotalDue (number)
  - (later) per programme/cohort fee structures

Endpoints:
- GET /fees/students/:studentId/summary
  - Returns: { totalPaid, totalDue, balance, lastPayment, badge }
  - Allowed: registrar/hod/admin/finance/principal
- GET /fees/students/:studentId/transactions
  - Returns: full payment list
  - Allowed: registrar/finance/admin only
- POST /fees/entry (finance/admin only)
  - Manual payment entry + audit log
- POST /fees/import (finance/admin only)
  - CSV import (studentId, amount, reference, paid_at)
  - Validate + bulk insert + audit log

Note:
- No workflow for fees in v1 (status derived from balance).
- SchoolPay webhook stub: leave POST /webhooks/schoolpay as 501 Not Implemented.

Dev RBAC strictly enforced (test each role boundary).

Exit criteria:
- Non-finance roles see badge/summary only
- Only finance can POST /fees/entry and /fees/import
- Audit log captures all writes

---

## Prompt 15 — Admin Studio UI (web)

Web (apps/web/src/admin-studio):
Screens:
1) Config Dashboard
   - Current published version (id, published_at, published_by)
   - Draft version status
   - Last 5 audit log entries

2) Config Editor (JSON-first)
   - Create draft
   - JSON editor for payload
   - Validate → shows Zod errors inline
   - Publish + confirm dialog
   - Rollback + confirm dialog

3) Workflow Viewer
   - List workflow keys from config payload
   - Show states + transitions as a table

4) Navigation Editor
   - Per-role navigation list
   - Add/remove/reorder items (updates draft JSON)

Exit criteria:
- Non-developer can edit navigation/workflow JSON, validate, publish
- UI changes immediately after publish (ConfigProvider refetches or refresh)
- Rollback restores previous config and UI reflects it