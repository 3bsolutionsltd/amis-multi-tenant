# ADR-0001 — Deployment Model: Multi-Tenant Cloud vs VTI-Hosted Single-Tenant

- **Status:** Proposed
- **Date:** 2026-05-12
- **Deciders:** AMIS Steering Group (3B Solutions Ltd, UVTAB, pilot VTI principals)
- **Related issues:** [#151](https://github.com/3bsolutionsltd/amis-multi-tenant/issues/151), [#149](https://github.com/3bsolutionsltd/amis-multi-tenant/issues/149), [#150](https://github.com/3bsolutionsltd/amis-multi-tenant/issues/150)

## Context

After the first stakeholder demo (May 2026) two deployment topologies were
proposed for the Academic Management Information System (AMIS):

1. **Multi-tenant cloud (SaaS).** One AMIS instance hosted by 3B Solutions
   on a public cloud (Azure / AWS / Hetzner). Each VTI (Vocational Training
   Institute) is a tenant inside that instance, isolated by `tenant_id`
   and Postgres Row-Level Security.
2. **VTI-hosted single-tenant.** Each VTI runs its own AMIS instance, either
   on an on-prem server or a small VPS that the VTI owns. The codebase is
   the same; only the tenant table contains one row.

Both topologies are supported by the current code (the offline / PWA work in
Issue #149 explicitly enables single-tenant on intermittent connectivity).
The question is which to **recommend as the default** and which to support
as a documented exception.

## Decision Drivers

| #   | Driver                                  | Why it matters                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------- |
| D1  | Data sovereignty & DPA compliance       | Uganda Data Protection Act 2019; student PII; UNEB exam data         |
| D2  | Operational burden on the VTI           | VTIs have limited IT capacity; downtime hurts learners               |
| D3  | Total cost of ownership                 | VTIs are publicly funded; budgets are tight                          |
| D4  | Patch & upgrade cadence                 | UVTAB regulatory changes require quick rollout                       |
| D5  | Offline/intermittent-connectivity       | Many VTIs have unreliable internet; some have none                   |
| D6  | Security posture                        | Centralised hardening vs distributed unknown                         |
| D7  | UVTAB / inter-institute reporting       | National statistics require data aggregation                         |
| D8  | Vendor lock-in / exit                   | VTI must be able to leave with its data                              |

## Options Considered

### Option A — Multi-tenant cloud (SaaS) [recommended default]

3B Solutions runs `pre.amis.institute` (staging) and `amis.institute`
(prod). Each VTI logs in via its **institution code** (tenant slug) and is
isolated by RLS. Backups, patches, monitoring, and CVE response are
centralised.

### Option B — VTI-hosted single-tenant

Each VTI receives a Docker image (or offline bundle) and runs AMIS on a
local server. The VTI is responsible for backups, patching, and TLS.
Updates are delivered as quarterly bundles.

### Option C — Hybrid (default cloud, opt-out for on-prem)

Default: Option A. VTIs that cannot or will not use cloud (e.g. no internet,
strict data residency) deploy Option B with a signed support contract that
specifies their patching SLA.

## Decision Matrix (1 = poor … 5 = excellent)

| Driver                        | A — Cloud SaaS | B — VTI-hosted | C — Hybrid |
| ----------------------------- | :------------: | :------------: | :--------: |
| D1 Data sovereignty           |       3        |       5        |     4      |
| D2 VTI operational burden     |       5        |       1        |     4      |
| D3 Total cost of ownership    |       5        |       2        |     4      |
| D4 Patch/upgrade cadence      |       5        |       2        |     4      |
| D5 Offline tolerance          |       2        |       5        |     4      |
| D6 Security posture           |       5        |       2        |     4      |
| D7 National reporting         |       5        |       2        |     4      |
| D8 Vendor lock-in / exit      |       3        |       5        |     4      |
| **Total**                     |    **33**      |     **24**     |   **32**   |

## Decision

**Adopt Option C — Hybrid.**

- The **default** offering is the multi-tenant cloud (Option A) hosted at
  `amis.institute`. New VTIs are provisioned as tenants via the
  `scripts/provision-tenant.js` script (Issue #147).
- VTIs that **cannot** use cloud — documented justifications only:
  no/insufficient internet, written directive from a board, or sensitive
  pilot data — may opt into **VTI-hosted single-tenant** (Option B). They
  receive the offline Docker bundle (`docker-compose.offline.yml`) and a
  support contract that explicitly states the patching cadence.
- All deployments — cloud or self-hosted — share the same codebase, the
  same PWA offline support (Issue #149), and the same outbox/queue
  infrastructure. There is no fork.

## Consequences

### Positive

- Clear, defensible default for stakeholders ("we host it for you").
- Lower TCO and faster patching for the 80 % case.
- Centralised national reporting becomes feasible (one DB, RLS-scoped views).
- Single hardening surface for the security team.

### Negative / Trade-offs

- Cloud-hosted VTIs depend on `amis.institute` availability — we owe them
  an uptime SLA (see [ADMIN-GOVERNANCE.md](../ADMIN-GOVERNANCE.md)).
- Self-hosted VTIs add support overhead. We mitigate by limiting to
  documented exceptions and by shipping a tested offline bundle.
- Data residency arguments will be raised by some VTIs; we answer by
  hosting in a regional data centre (Africa) and signing DPAs.

### Follow-up actions

1. Draft and publish DPA template (Issue #150).
2. Document the offline-bundle deployment runbook (`docker-compose.offline.yml`).
3. Define uptime SLA tiers in [ADMIN-GOVERNANCE.md](../ADMIN-GOVERNANCE.md).
4. Add `tenant.deployment_mode` column ('cloud' | 'self_hosted') for support
   metrics (deferred — not blocking).
