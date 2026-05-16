# Changelog

All notable changes to AMIS are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged automatically by the release pipeline on merge to `main`.

---

## [Unreleased]

> Changes merged to `main` but not yet assigned a release tag.

---

## [3.0.0] — 2026-05-16

### Added
- ISO 9001:2015-aligned GitHub Actions CI pipeline with `pnpm audit` and `dbmate up` steps
- GitHub Dependabot configuration for weekly dependency updates
- Issue templates: Feature Request and Bug Report (`.github/ISSUE_TEMPLATE/`)
- `SECURITY.md` — security policy, controls documentation, and responsible disclosure process
- `CONTRIBUTING.md` — developer onboarding, branching strategy, commit convention, coding standards
- `README.md` — root-level architecture overview, quick-start guide, and documentation index
- `CHANGELOG.md` — this file
- Release tagging workflow (`.github/workflows/release.yml`)

### Changed
- `DEPLOY-WORKFLOW.md` Part 0 updated to enforce PR-based workflow (branch protection)

---

## [2.1.0] — 2026-05-08

### Added
- OTP token support (`20260511000065_otp_tokens.sql`)
- Admissions reporting and workflow improvements (`20260508000063`)
- Fix app role grants (`20260508000064`)
- QA-cycle bug fixes: reset password, forgot password, role-based route guards, user name fields

### Changed
- `modules` config key widened from fixed keys to `Record<string, boolean>`
- Student create page converted to 4-tab layout (Bio / Placement / NOK / UVTAB)

---

## [2.0.0] — 2026-04-29

### Added
- UVTAB EIMS CSV export endpoint and student fields (`assessment_level`, `previous_index`)
- Digital IT Logbook (`20260429000056_it_logbook.sql`)
- Mark entry evidence attachments (`20260429000057`)
- Student project costing (`20260429000058`)
- Store requisitions, petty cash vouchers (`20260429000059–060`)
- Payments `term_id` FK (`20260429000053`)
- Term registrations FK references (`20260429000054`)
- Admission applications `status` column (`20260429000055`)
- IAM improvements and new roles (`20260429000048–049`)
- Notifications table (`20260427000047`)

---

## [1.0.0] — 2026-04-07

### Added
- Initial multi-tenant platform: schemas, RLS, tenant context function
- Students, admissions, marks, finance, clearance, staff/HR, procurement/inventory modules
- PostgreSQL 16 Row-Level Security across all app-schema tables
- Fastify API with Zod validation and JWT authentication
- React + Vite frontend with role-based sidebar and route guards
- dbmate migration infrastructure
- GitHub Actions CI pipeline (test + build jobs)
- Docker Compose for local development, staging, and production
- `USER_MANUAL.md`, `DEPLOY.md`, `DEPLOY-WORKFLOW.md`
