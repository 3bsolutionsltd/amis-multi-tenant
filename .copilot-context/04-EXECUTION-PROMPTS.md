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

1. Request context:
   - request.user = { tenantId: string, role: string, userId: string }

2. Middleware reads headers:
   - x-tenant-id → tenantId (keep existing)
   - x-dev-role → role (default: 'admin' if missing)
   - x-dev-user-id → userId
     - If missing, assign deterministic UUID by role:
       admin -> 00000000-0000-0000-0000-000000000001
       registrar -> 00000000-0000-0000-0000-000000000002
       hod -> 00000000-0000-0000-0000-000000000003
       instructor -> 00000000-0000-0000-0000-000000000004
       finance -> 00000000-0000-0000-0000-000000000005
       principal -> 00000000-0000-0000-0000-000000000006
     - Unknown role defaults to admin uuid.

3. Add helper: requireRole(...roles: string[])
   - Throws 403 if request.user.role not in roles
   - Use as a Fastify preHandler hook

4. Update workflow endpoints:
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

1. Extend config Zod schema with OPTIONAL UI sections + defaults:
   - branding: { appName: string, logoUrl?: string } (default appName='AMIS')
   - theme: { primaryColor: string } (default '#2563EB')
   - navigation: Record<role, Array<{ label: string, route: string }>> (default {})
   - dashboards: Record<role, Array<{ type: 'KPI'|'ACTION', label: string,
     metricKey?: string, route?: string }>> (default {})

2. Update seed tenant configs to include UI config sections.

Web:

1. DevTenantSwitcher (localStorage → x-tenant-id header)
2. DevRoleSwitcher (localStorage → x-dev-role header)
3. ConfigProvider: fetches GET /config (TanStack Query, 60s cache)
4. AppShell:
   - header from branding.appName
   - sidebar from navigation[role] (fallback: minimal default menu)
   - dashboard cards from dashboards[role] (fallback: empty)
   - CSS variable --primary-color from theme.primaryColor

Exit criteria:

- Switching tenant changes appName/theme/menu/dashboard
- Switching role changes visible navigation/dashboard
- Publishing new config changes UI after refetch

---

## Prompt 10 — Student Management v1 (CRUD + config-aware form)

API (apps/api/src/modules/students):

- GET /students (search, status filter, pagination)
- GET /students/:id
- POST /students (requireRole: registrar, admin)
- PUT /students/:id (requireRole: registrar, admin)
- tenantTx on all queries
- students.extension jsonb default '{}' (add if missing)
- Zod validate request bodies

Tests:

- CRUD success + 400/404
- RLS isolation (tenant A cannot read tenant B)
- 403 for wrong role on write routes

Web (apps/web/src/features/students):

- Students list (search + filter + pagination)
- Student detail page
- Create student form (React Hook Form + Zod)
- Field order/labels/visibility from config.forms.students if present
- Extension fields from config.forms.students.extensionFields if present

Exit criteria:

- Student CRUD works + RLS tested + RBAC tested
- Form driven by config (even minimal)

---

## Prompt 11 — Workflow Engine enhancements

API:

1. GET /workflow/:entityType/:entityId?workflowKey=
   - Returns: { workflowKey, currentState }
   - 404 if instance missing

2. GET /workflows/:workflowKey
   - Returns definition from published config payload

3. Improve transition endpoint:
   - Verify workflowKey matches instance.workflow_key
   - Verify transition allowed from currentState
   - Store actor_user_id from request.user.userId

Exit criteria:

- UI can GET /workflows/admissions → render action buttons
- GET /workflow/admissions/:id → current state
- Invalid transitions return 400 with reason
- actor_user_id stored on all transitions

---

## Prompt 12 — Admissions v1 (applications + TVET import + workflow)

Tables (migrations):

- app.admission_applications (tenant_id, first_name, last_name, programme,
  intake, dob, gender, created_at, extension jsonb default '{}')
- app.admission_import_batches (tenant_id, filename, status, row_count,
  imported_by, created_at)

Endpoints:

- POST /admissions/applications
  - Creates application + inits workflow (entityType=admissions,
    workflowKey=admissions, initial_state from definition)
- GET /admissions/applications
  - Joins workflow_instances for current_state
  - Filters: intake, programme, current_state
- GET /admissions/applications/:id
- POST /admissions/import (CSV parse + validate → preview, no insert)
- POST /admissions/import/:batchId/confirm
  - Bulk insert valid rows + init workflow per application

Dev RBAC: registrar/admin all; others read only

Exit criteria:

- Status from workflow_instances.current_state (no status column)
- Import preview + confirm works
- Transitions: Submit/Review/Accept/Reject work

---

## Prompt 13 — Marks v1 (submission model + immutable audit)

Tables (migrations):

- app.mark_submissions (tenant_id, course_id, programme, intake, term,
  created_by, created_at, correction_of_submission_id nullable)
- app.mark_entries (tenant_id, submission_id, student_id, score,
  updated_by, updated_at)
- app.mark_audit_log (tenant_id, submission_id, entry_id, old_score,
  new_score, actor_user_id, changed_at) — append-only

Endpoints:

- POST /marks/submissions (requireRole: instructor, admin)
  - Creates + inits workflow (entityType=marks, workflowKey=marks)
- PUT /marks/submissions/:id/entries
  - BLOCK if workflow state = PUBLISHED
  - Append to mark_audit_log on every change
- GET /marks/submissions (filters: course/intake/term/state)
- GET /marks/submissions/:id (entries + workflow state)

Workflow states: DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED
Corrections: new submission with correction_of_submission_id

Dev RBAC:

- instructor: create/update draft/submit
- hod: approve/return
- registrar/admin: publish
- principal: read

Exit criteria:

- PUBLISHED = immutable (server enforced + tested)
- Every entry change → mark_audit_log row
- actor_user_id on all transitions

---

## Prompt 14 — Fees v1 (role-gated visibility + manual entry + CSV import)

Tables (migrations):

- app.payments (tenant_id, student_id, amount, currency, reference,
  paid_at, source, imported_by, created_at)
- app.fee_audit_log (tenant_id, payment_id, action, actor_user_id,
  created_at) — append-only, writes/imports only

Config addition:

- payload.fees.defaultTotalDue (number) for balance computation

Endpoints:

- GET /fees/students/:studentId/summary
  - { totalPaid, totalDue, balance, lastPayment, badge }
  - requireRole: registrar, hod, admin, finance, principal
- GET /fees/students/:studentId/transactions
  - requireRole: registrar, finance, admin
- POST /fees/entry (requireRole: finance, admin)
  - Manual entry + audit log
- POST /fees/import (requireRole: finance, admin)
  - CSV (studentId, amount, reference, paid_at)
  - Validate + bulk insert + audit log
- POST /webhooks/schoolpay → 501 Not Implemented (stub only)

No workflow for fees in v1 (status = balance computation).

Exit criteria:

- Non-finance roles: summary only
- Only finance: POST entry/import
- All writes audited

---

## Prompt 15 — Admin Studio UI (web)

Screens (apps/web/src/admin-studio):

1. Config Dashboard
   - Published version (id, published_at, published_by)
   - Draft status
   - Last 5 audit entries

2. Config Editor (JSON-first)
   - Create draft
   - JSON textarea for payload editing
   - Validate → inline Zod errors
   - Publish (confirm dialog)
   - Rollback (confirm dialog)

3. Workflow Viewer
   - List workflow keys from config payload
   - States + transitions as table

4. Navigation Editor
   - Per-role navigation list
   - Add/remove/reorder (updates draft JSON)

Exit criteria:

- Non-developer can edit JSON, validate, publish
- UI changes immediately after publish (ConfigProvider refetches)
- Rollback restores previous config + UI reflects it
