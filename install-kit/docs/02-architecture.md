# 2. System Architecture

AMIS ships as **four Docker containers** that run together on a single host.

```
                      ┌────────────────────────────────────────────┐
                      │            Institutional LAN               │
                      │                                            │
   Browser  ────►  ┌──┴──┐                                         │
  (LAN clients)    │ Web │ React SPA, served by Nginx              │
                   │ :80 │                                         │
                   └──┬──┘                                         │
                      │ REST/JSON                                  │
                      ▼                                            │
                   ┌─────┐                                         │
                   │ API │ Fastify + TS, JWT auth, Zod validation  │
                   │:3001│                                         │
                   └──┬──┘                                         │
                      │ libpq (internal docker network)            │
                      ▼                                            │
                   ┌─────┐                                         │
                   │ DB  │ PostgreSQL 16 + RLS                     │
                   │:5432│ volume: pgdata_offline                  │
                   └─────┘                                         │
                                                                   │
                   ┌────────┐                                      │
                   │migrate │ dbmate — one-shot, idempotent        │
                   └────────┘                                      │
                      └────────────────────────────────────────────┘
```

## Components

| Container | Image | Role |
|-----------|-------|------|
| `db` | `amis-postgres:offline` (=`postgres:16-alpine`) | System of record. Row-Level Security per tenant. |
| `api` | `amis-api:offline` | Fastify REST API, JWT auth, file uploads, reporting. |
| `web` | `amis-web:offline` | React + Vite SPA served by Nginx. |
| `migrate` | `amis-dbmate:offline` | Applies SQL migrations on startup, then exits. |

## Multi-tenancy

- Tenant isolation is enforced **at the database layer** with PostgreSQL Row-Level Security (RLS).
- Every API request sets `withTenant(tenantId, …)` before running queries.
- Database row-level security helps isolate tenant data, and API requests are scoped to their tenant.
- This kit supports one institute per installation. Multi-institute hosting is outside its supported scope.

## Default network

| Component | LAN address | Exposure |
|-----------|-------------|----------|
| Web UI | `http://<server-address>/` | TCP 80, institution LAN |
| API | `http://<server-address>:3001/` | TCP 3001, institution LAN |
| Database | Internal Docker network | Not exposed on the host |

> **Database port 5432 is never exposed** — it is only reachable on the internal Docker network.
