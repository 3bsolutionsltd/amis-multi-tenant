# AMIS — Administration & Governance Model

> Companion to [ADR-0001](./adr/0001-deployment-model.md).
> Addresses Issue [#150](https://github.com/3bsolutionsltd/amis-multi-tenant/issues/150)
> raised in the May 2026 stakeholder demo.

This document defines who administers what in AMIS, how support is delivered,
and the SLAs that VTIs (Vocational Training Institutes) can expect from 3B
Solutions Ltd as the AMIS operator.

## 1. Roles

AMIS has two administrative layers; users hold roles at exactly one layer.

### 1.1 Platform administrator (3B Solutions)

- Role name in DB: `platform_admin`
- Holds the keys to **all** tenants.
- Responsible for:
  - Provisioning new VTI tenants (`scripts/provision-tenant.js`).
  - Patches, dependency upgrades, CVE response.
  - Backups, disaster recovery, monitoring, on-call.
  - UVTAB-wide configuration changes (national grading scale revisions,
    new programme codes, etc.).
- Day-to-day staff: 3B Solutions support engineers under written NDA.

### 1.2 Institute administrator (VTI)

- Role name in DB: `admin`
- Scope: **single tenant only** (enforced by Postgres Row-Level Security).
- Responsible for:
  - Adding/removing staff users, assigning role-bound permissions.
  - Configuring institute-specific calendar, fee structure, programmes.
  - Approving admissions, releasing marks, certifying graduations.
  - Front-line support to their own staff and students.
- Cannot:
  - See or touch any other tenant's data.
  - Modify the schema, deploy code, or rotate the JWT secret.

### 1.3 Support tiers

| Tier  | Owner          | Handles                                                  |
| :---: | -------------- | -------------------------------------------------------- |
|   1   | VTI admin      | Staff / student questions, day-to-day data entry issues  |
|   2   | 3B Helpdesk    | Errors, login problems, data export requests             |
|   3   | 3B Engineering | Bugs, data corrections, security incidents               |

## 2. Provisioning a new VTI

1. VTI signs the **Service Agreement** (cloud) or the **Self-Hosting Addendum**
   (on-prem, see ADR-0001).
2. 3B platform admin runs:
   ```bash
   DATABASE_URL=… node scripts/provision-tenant.js \
     --slug greenfield-vti \
     --name "Greenfield VTI" \
     --email principal@greenfield.ac.ug \
     --first Jane --last Mukasa
   ```
3. The script writes `provisioned-greenfield-vti.txt` (mode 0600) with
   credentials. 3B delivers it to the institute via a sealed channel
   (encrypted PDF, password sent on a separate channel).
4. The VTI admin signs in at `https://amis.institute/login`, changes the
   password, and invites additional staff.

## 3. SLAs (cloud-hosted tenants)

| Item                          | Target                            |
| ----------------------------- | --------------------------------- |
| Uptime (rolling 90 d)         | 99.5 %                            |
| Planned-maintenance window    | Sundays 02:00–05:00 EAT (UTC+3)   |
| Notification of maintenance   | ≥ 5 business days in advance      |
| Backup frequency              | Daily full + 6-hourly WAL         |
| Backup retention              | 30 days                           |
| RPO (recovery point objective)| 6 hours                           |
| RTO (recovery time objective) | 8 hours                           |
| Tier-3 response (Sev-1)       | 4 hours business / 8 h after-hours|
| Tier-3 response (Sev-2)       | 1 business day                    |
| Tier-3 response (Sev-3/4)     | 5 business days                   |

Self-hosted tenants (ADR-0001 Option B) operate their own backups and uptime;
3B supports patches and bug fixes only, on the cadence in their support
contract (default: quarterly).

## 4. Release cadence

- **Patches & security fixes:** rolling, deployed to staging
  (`pre.amis.institute`) first, then production after at least 24 h of
  smoke-testing. Critical CVEs override this gating.
- **Feature releases:** monthly, batched into a release notes post.
- **Schema migrations:** delivered via `dbmate`; staging is always one
  release ahead of prod so VTIs see new fields on staging first.

## 5. Data ownership & data-protection

- The VTI is the **data controller** for its tenant's records. 3B Solutions
  is the **data processor**. A DPA (Data Processing Agreement) is signed
  per tenant; the template lives in `docs/legal/` (TBD).
- Personal data is processed only for the purposes set out in the DPA.
- On termination, the VTI receives a full SQL + file export within 30 days;
  3B retains an encrypted backup for legal-hold purposes (1 year) then
  destroys it.
- Sub-processors (currently: hosting provider, Resend for email, Sentry for
  errors) are listed in the DPA and changed only with 30 days notice.

## 6. Change-management & approvals

- All schema changes go through **PR review** in
  `3bsolutionsltd/amis-multi-tenant`. Branch protection requires:
  - 1 approving review
  - CI `test` job green
  - No stale reviews
- Production deploys require sign-off by a second 3B engineer (4-eyes
  principle). Audit log is the GitHub PR + the deploy log on the VPS.
- VTI admins are notified of UVTAB-wide config changes (national grading
  scale, programme codes) at least 14 days before they take effect.

## 7. Incident response

- Sev-1 (data breach, total outage, data loss) — 3B on-call paged within
  15 minutes; affected VTIs informed within 1 hour; UVTAB informed within
  4 hours.
- Sev-2 (degraded performance, partial outage, isolated user-facing bug) —
  next business hour.
- Post-incident review (PIR) shared with affected VTIs within 5 business
  days for Sev-1 and within 10 days for Sev-2.

## 8. Open items

These are tracked separately and will be folded in once decided:

- DPA template language (legal review pending).
- UVTAB approval & accreditation status (in progress).
- Pricing model for self-hosted support tier (ADR-0001 Option B).
