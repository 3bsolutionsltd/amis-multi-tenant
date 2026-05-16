# AMIS — Academic Management Information System

**Version:** 3.0 · **Stack:** Fastify · PostgreSQL 16 · React · Vite · pnpm monorepo  
**Live:** [amis.institute](https://amis.institute) · **Staging:** [pre.amis.institute](https://pre.amis.institute)

AMIS is a multi-tenant SaaS platform for technical and vocational education institutions.
It manages the full student lifecycle — admissions, enrolment, marks, fees, clearance, and
alumni — while supporting multiple institutions from a single deployed instance.

---

## Architecture Overview

```
amis-multi-tenant/
├── apps/
│   ├── api/        Fastify + TypeScript REST API (port 3000)
│   └── web/        React + Vite SPA (port 5173)
├── db/
│   ├── migrations/ SQL migrations managed by dbmate (sequential)
│   └── seeds/      Development seed data
├── nginx/          Reverse-proxy config (staging + production)
└── scripts/        Utility/automation scripts
```

**Tenant isolation** is enforced at the database layer via PostgreSQL Row-Level Security (RLS).
Every API request sets a tenant context using `withTenant(tenantId, callback)` before any query
executes. Cross-tenant data access is structurally impossible through the application layer.

| Layer | Technology |
|-------|-----------|
| API | Fastify, TypeScript, Zod validation |
| Database | PostgreSQL 16, RLS, dbmate migrations |
| Frontend | React 18, Vite, TypeScript |
| Auth | JWT (short-lived access + refresh tokens) |
| Infrastructure | Docker Compose, Nginx, Contabo VPS |
| CI/CD | GitHub Actions |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+, pnpm 9+, Docker Desktop, [dbmate](https://github.com/amacneil/dbmate)

### 1. Clone and install
```powershell
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git
cd amis-multi-tenant
pnpm install
```

### 2. Start the database
```powershell
docker compose up -d
```

### 3. Configure environment
```powershell
copy .env.example .env
# Edit .env — set DATABASE_URL and APP_DATABASE_URL
```

### 4. Run migrations and seed
```powershell
dbmate up
pnpm seed
```

### 5. Start the development servers
```powershell
pnpm dev
# API → http://localhost:3000
# Web → http://localhost:5173
```

### Default dev credentials
All seeded accounts use password `Password123!`. See [USER_TESTING_GUIDE.md](USER_TESTING_GUIDE.md) for the full list.

---

## Running Tests

```powershell
pnpm test          # run all tests across the monorepo
pnpm --filter api test   # API tests only (Vitest)
```

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Tenant** | A single institution, isolated by RLS |
| **`withTenant(tid, cb)`** | Sets DB tenant context; wraps every query |
| **dbmate migrations** | Sequential, timestamped `.sql` files in `db/migrations/` |
| **Config versions** | Each tenant has a published config controlling modules, nav, forms |
| **Roles** | `platform_admin`, `admin`, `registrar`, `finance`, `hod`, `instructor`, `principal`, `dean` |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [USER_MANUAL.md](USER_MANUAL.md) | End-user guide for all roles and modules |
| [DEPLOY.md](DEPLOY.md) | First-time production deployment runbook |
| [DEPLOY-WORKFLOW.md](DEPLOY-WORKFLOW.md) | Day-to-day deployment reference (scenarios A–F) |
| [USER_TESTING_GUIDE.md](USER_TESTING_GUIDE.md) | QA test credentials and scenarios |
| [QA-TRACKER.md](QA-TRACKER.md) | Known bugs, feature requests, and their status |
| [PROJECT_TODO.md](PROJECT_TODO.md) | Structured backlog linked to GitHub issues |
| [SECURITY.md](SECURITY.md) | Security policy and responsible disclosure |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developer workflow and contribution guide |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch workflow, PR process, and coding standards.
All contributions require a linked GitHub issue and a passing CI pipeline before merge.

## License

Proprietary — © 2026 3B Solutions Ltd. All rights reserved.
