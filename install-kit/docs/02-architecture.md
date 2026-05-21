# 2. System Architecture

AMIS ships as **four Docker containers** that run together on a single host.

```
                      ┌────────────────────────────────────────────┐
                      │   Institutional LAN  (or VPS in cloud mode)│
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
- Cross-tenant data access is **structurally impossible** through application code.
- A single AMIS install can host one VTI or many (rare for on-prem; common for cloud).

## Default network

| Mode | Web | API | DB |
|------|-----|-----|----|
| Offline / LAN | `:80` exposed on LAN | `:3001` exposed on LAN | not exposed |
| Cloud / VPS | `127.0.0.1:8095` (Nginx + TLS) | `127.0.0.1:3001` (Nginx) | not exposed |

> **Database port 5432 is never exposed** — it is only reachable on the internal Docker network.
