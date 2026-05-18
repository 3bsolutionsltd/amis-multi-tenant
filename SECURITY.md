# Security Policy

## Supported Versions

Only the latest `main` branch is actively supported. No backport patches are issued.

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ |
| Any previous tag/commit | ❌ |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **security@3bsolutionsltd.com** with:

1. A description of the vulnerability and its potential impact.
2. Steps to reproduce the issue (proof-of-concept if applicable).
3. Any suggested remediation.

You will receive an acknowledgement within **2 business days**.  
We target a full remediation or mitigation within **14 calendar days** for critical issues.

We will coordinate a disclosure timeline with you and credit you in the release notes
(unless you prefer to remain anonymous).

---

## Security Controls in AMIS

### Multi-Tenant Data Isolation
- All database queries execute inside a tenant context set via `withTenant(tenantId, callback)`.
- PostgreSQL Row-Level Security (RLS) policies enforce that no query can read or write
  data belonging to a different tenant, even if application logic is bypassed.
- RLS policies are defined in `db/migrations/` and are covered by integration tests.

### Authentication & Sessions
- Authentication uses short-lived JWT access tokens combined with rotating refresh tokens.
- Refresh tokens are stored in the database and invalidated on logout.
- Passwords are hashed using bcrypt (cost factor ≥ 12).
- Password reset tokens are single-use and expire after 1 hour.

### Authorisation
- All API routes enforce role-based access control via the `requireRole` middleware.
- The frontend enforces route guards via `RequireRole` — these are defence-in-depth only;
  the API is the authoritative enforcement point.
- Platform-admin routes are isolated under the `platform_admin` role and are not accessible
  to any tenant-scoped role.

### Secrets Management
- No secrets, credentials, or API keys are committed to version control.
- Secrets are injected at runtime via environment variables.
- Environment variable templates (`.env.*.example`) contain only placeholder values.
- The CI pipeline uses GitHub Actions secrets for all sensitive values.

### Dependency Security
- `pnpm audit --audit-level=high` runs in the CI pipeline on every push and pull request.
- GitHub Dependabot is configured to raise PRs for dependency updates weekly.
- High or critical vulnerabilities block the CI pipeline.

### Infrastructure
- The API container binds only to `127.0.0.1` (loopback) in production; Nginx proxies it.
- TLS is terminated at Nginx using Let's Encrypt certificates (certbot auto-renewal).
- Docker containers run as non-root users.

---

## Known Security Assumptions / Limitations

- The `x-dev-role` header is available in the test environment only and is stripped in
  production by Nginx configuration. It must never be forwarded to the API in production.
- The system does not currently implement rate-limiting on authentication endpoints.
  This is tracked in the backlog as a high-priority improvement.
