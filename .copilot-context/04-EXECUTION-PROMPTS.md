# Execution Prompts (Run in Order)

## Prompt 1 — Scaffold monorepo + apps
Create apps/api and apps/web as pnpm workspace packages.
- apps/api: Fastify + TS, dev/build scripts, /health endpoint.
- apps/web: Vite React TS, dev/build scripts, home page.
Ensure pnpm dev runs both.

## Prompt 2 — dbmate migrations + schemas + RLS
Add db/migrations and dbmate usage. SQL migrations to:
- Create schemas: platform, app
- Enable extension pgcrypto
- Create function app.current_tenant_id()
- Create platform.tenants, platform.users, minimal RBAC
- Create app.students
- Enable RLS + policies on app.students

## Prompt 3 — API DB + tenant context
Implement pg pool and a transaction helper that:
- begins tx
- SET LOCAL app.tenant_id
- runs queries
Add endpoints POST/GET /students.
Use Zod validation.
Add tests (Fastify inject).

## Prompt 4 — Seed + RLS proof test
Seed two tenants + students.
Add test proving tenant A cannot read tenant B due to RLS.

## Prompt 5 — Config versioning skeleton
Migrations + endpoints:
- POST /config/draft
- POST /config/validate
- POST /config/publish
- POST /config/rollback
- GET /config
Audit publish/rollback.

## Prompt 6 — Workflow engine skeleton
Tables:
- platform.workflow_definitions (jsonb)
- app.workflow_events (append-only)
Endpoint:
- POST /workflow/:entity/:id/transition
Admissions example workflow.

## Prompt 7 — Web dev tenant switch + students UI
Web app:
- set tenant_id in localStorage
- send x-tenant-id header
- list/create students (TanStack Query)