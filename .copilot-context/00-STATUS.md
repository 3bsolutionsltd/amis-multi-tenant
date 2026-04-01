# AMIS Rebuild — Current Status (as of 2026-04-01)

## Goal
Rebuild AMIS cleanly as a multi-tenant configurable platform for VTIs:
- Tenant self-service configuration
- Configurable UI (dashboards + limited custom pages)
- Configurable workflows (Admissions, Marks, Fees status, Student lifecycle)
- Offline capability later (IndexedDB + sync queue)
- Strong tenant isolation enforced in DB

## Confirmed decisions
- Monorepo (pnpm workspaces)
- Backend: Fastify + TypeScript
- Database: PostgreSQL shared tables + `tenant_id` + Row-Level Security (RLS)
- Migrations: SQL-first using dbmate
- Frontend: React + TypeScript + Vite
- Validation: Zod
- Cache/Queue: Redis + BullMQ (later; stub ok)

## Pilot modules (Phase 1)
1) Student Management
2) Admissions (incl. TVET CSV import)
3) Marks / Assessment (entry → approve/publish + audit)
4) Fees (student fee status visibility; integration-ready)

## Key product principle
Everything configurable, but not everything editable.
- Configurable: modules, nav/pages/dashboards, forms/fields, workflows
- Not editable (fixed): tenant isolation, RBAC enforcement, audit rules, no tenant scripts

## Immediate next implementation steps
1) Scaffold monorepo (apps/api, apps/web, packages/*)
2) Add dbmate migrations for schemas + RLS helper + base tables
3) Add API DB layer and tenant context handling (SET LOCAL app.tenant_id)
4) Add students endpoints + tests proving RLS isolation
5) Add config versioning skeleton + endpoints
6) Add workflow engine skeleton + admissions example
7) Add web dev tenant switch + students UI

## Notes
- Start dev with x-tenant-id header (temporary), later switch to JWT tenant claim.