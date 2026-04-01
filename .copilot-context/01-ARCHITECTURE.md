# AMIS Architecture Summary (v3)

## Tenancy
- Shared tables, each row has `tenant_id uuid not null`
- Postgres RLS enabled on every tenant-scoped table
- API sets tenant context per transaction: `SET LOCAL app.tenant_id = $1`
- Helper: `app.current_tenant_id()` reads `current_setting('app.tenant_id', true)::uuid`

## Schemas
- `platform` schema: tenants, users, roles/permissions, config versions, workflow definitions, pages
- `app` schema: business data (students, admissions, marks, fees), workflow events

## Engines (platform primitives)
- Config/versioning engine: draft → validate → publish → rollback
- UI engine: page definitions + form definitions (whitelisted components)
- Workflow engine: state machine definitions + append-only event log
- Module toggles: config-driven feature availability

## Guardrails
- No tenant-provided scripts/custom code in pilot
- Config uses JSON with Zod validation
- Strong audit trail for marks + finance + config changes