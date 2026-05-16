# Contributing to AMIS

Thank you for contributing to the AMIS platform. This guide describes the workflow,
standards, and processes every contributor must follow.

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Branching Strategy](#2-branching-strategy)
3. [Commit Message Convention](#3-commit-message-convention)
4. [Pull Request Process](#4-pull-request-process)
5. [Coding Standards](#5-coding-standards)
6. [Database Migrations](#6-database-migrations)
7. [Testing Requirements](#7-testing-requirements)

---

## 1. Local Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 9 | `npm i -g pnpm@9` |
| Docker Desktop | Latest | [docker.com](https://docker.com) |
| dbmate | Latest | [github.com/amacneil/dbmate](https://github.com/amacneil/dbmate/releases) |

### Setup

```powershell
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git
cd amis-multi-tenant
pnpm install
copy .env.example .env          # then fill in DATABASE_URL etc.
docker compose up -d            # start Postgres
dbmate up                       # apply all migrations
pnpm seed                       # load dev seed data
pnpm dev                        # start API (:3000) and Web (:5173)
```

---

## 2. Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. **Branch protection is active.** Direct pushes are blocked. |
| `feat/<short-description>` | New features |
| `fix/<short-description>` | Bug fixes |
| `chore/<short-description>` | Dependency updates, tooling, docs |
| `hotfix/<short-description>` | Emergency production fixes (short-lived) |

**Workflow:**
1. Create a branch from `main`.
2. Make your changes and commit.
3. Push the branch and open a Pull Request targeting `main`.
4. The CI pipeline must pass and at least **1 reviewer must approve** before merging.
5. Merge using **Squash and Merge** for features/fixes; **Merge Commit** for hotfixes.
6. Delete the branch after merge.

---

## 3. Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Tooling, dependencies, non-functional |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `refactor` | Code change with no functional effect |
| `migration` | New database migration file |

**Examples:**
```
feat(finance): add term_id filter to fee collection report
fix(auth): prevent refresh token reuse after logout
migration: add term_id column to app.payments
docs: update DEPLOY-WORKFLOW.md branching section
```

---

## 4. Pull Request Process

1. **Open an issue first** using the appropriate [Issue Template](.github/ISSUE_TEMPLATE/).
   Every PR must be linked to an issue (`Closes #<number>`).
2. **Fill in the PR template** completely — do not delete sections.
3. **Ensure CI passes** — the `test` job (including `pnpm audit` and `dbmate up`) must be green.
4. **Request a review** from at least one other contributor.
5. Address all review comments before merging.
6. **Never force-push to `main`**.

---

## 5. Coding Standards

### API (`apps/api` — Fastify + TypeScript)

- All route handlers must have Zod schemas for `body`, `params`, and `querystring`.
- All database access must go through `withTenant(tenantId, callback)` — never run raw
  queries outside this wrapper on tenant data.
- Return `422` for validation errors, `401` for authentication failures, `403` for authorisation
  failures, `404` for missing resources.
- No raw SQL strings with unparameterised user input — always use `$1, $2, ...` placeholders.

### Frontend (`apps/web` — React + Vite + TypeScript)

- Use `RequireRole` for all routes that are role-restricted.
- API calls go through the typed API modules in `src/modules/<module>/<module>.api.ts`.
- Do not store JWT tokens in `localStorage`. Use `httpOnly` cookies or the existing
  in-memory token pattern.

### General

- No secrets or credentials in source code.
- No `console.log` left in committed code (use the logger).
- Run `pnpm lint` and `pnpm typecheck` before pushing.

---

## 6. Database Migrations

- Create migration files in `db/migrations/` using the naming convention:
  `YYYYMMDDHHMMSS_description.sql`
- Migrations must be **forward-only**. Write a separate rollback migration if needed.
- Always add `-- migrate:up` and `-- migrate:down` dbmate headers.
- Test your migration locally with `dbmate up` before pushing.
- Migrations that modify RLS policies must be reviewed by a second contributor.

---

## 7. Testing Requirements

- All new API routes must have at least one happy-path and one error-path test.
- Tests live in `apps/api/src/tests/` (or co-located `*.test.ts` files).
- Use the project's `withTenant` mock patterns — see the existing tests for reference.
- Run the full suite locally with `pnpm test` before opening a PR.
- A test that passes locally but fails in CI is a blocker for merge.
