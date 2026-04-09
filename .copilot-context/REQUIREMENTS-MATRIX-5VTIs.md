# Requirements Matrix — 5 VTIs (from Combined SRD 2026-04-09)

> Status: **Reference / planning**. This matrix converts SR-F requirements into deliverable epics and waves.
> Source document: `.copilot-context/Combined-SRD-2026-04-09.md` (SRD-COMBINED-5VTIs-001)

## Legend

- **Delivery Type**
  - **Config**: per-tenant configuration only (forms, workflows, navigation, fee rules)
  - **Platform**: new AMIS platform feature (DB + API + UI)
  - **Integration**: external system integration (e.g., SchoolPay)
  - **Report**: reporting/analytics endpoint + optional configurable dashboards
- **Wave**
  - **Wave1**: foundations (auth, roles, tenant isolation) — already complete
  - **Wave2**: minimum viable operations (shared HIGH items)
  - **Wave3**: advanced operations (attendance, HR, industrial training, surveys)
  - **Wave4**: integrations + cross-VTI analytics (SchoolPay)

> **Note on “Shared?”**: Marked **Yes** where the same need appears across multiple VTIs (theme-level), even if SRD doesn’t explicitly label it.

---

## Epic A — Student Registry & Lifecycle

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-001 | HIGH | Registrar | Milennium Business School | Yes | Platform + Report | Wave2 | Student CRUD + enrollment workflows + student reports |
| SR-F-002 | HIGH | Registrar | ST SIMON PETER'S VTI | Yes | Platform + Config | Wave2 | Student profile incl. guardian/next-of-kin fields (configurable) |
| SR-F-003 | HIGH | Registrar | ST SIMON PETER'S VTI | Yes | Platform + Report | Wave3 | Dropout tracking (statuses, reasons, cohort progression reports) |
| SR-F-004 | HIGH | Registrar | UTC KYEMA | Yes | Platform | Wave2 | Central student master record + synchronized access across roles |
| SR-F-005 | HIGH | Coordinator Academics and Training (CAT) | Kasese Technical Institute | Yes | Platform + Report | Wave2 | Student data + CAT reporting exports |
| SR-F-006 | HIGH | Registrar | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave2 | Fast capture + retrieval; role-based access |
| SR-F-007 | HIGH | Registrar | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Report | Wave3 | Management reports: students/activities/financial summaries |
| SR-F-008 | HIGH | Registrar | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave2 | “360° student view” (single page aggregate) |
| SR-F-009 | MEDIUM | — | Milennium Business School | Unknown | Backlog (clarify) | — | SRD entry empty → needs clarification |
| SR-F-011 | MEDIUM | Liaison Officer | UTC KYEMA | No | Platform | Wave3 | Alumni transition: mark graduated → alumni table/export |

---

## Epic B — Admissions & Intake

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-010 | MEDIUM | Registrar | UTC KYEMA | No | Platform + Config | Wave3 | Online private applications (public form + admissions workflow) |
| SR-F-028 | HIGH | Registrar | UTC KYEMA | Yes | Platform | Wave2 | Bulk intake import (CSV/Excel) + validation + confirm |
| SR-F-029 | MEDIUM | Registrar | ST SIMON PETER'S VTI | Yes | Platform + Integration | Wave3/Wave4 | Online application + registration + payments (payments integration Wave4) |
| SR-F-030 | MEDIUM | Registrar's Office | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave2 | Application tracking pipeline (draft/submitted/review/accepted/rejected) |

---

## Epic C — Course / Programme Management

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-012 | HIGH | Principal | Milennium Business School | Yes | Platform + Config | Wave2 | Programmes/courses catalog + offerings per academic year |

---

## Epic D — Fees & Finance

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-013 | HIGH | Registrar | ST SIMON PETER'S VTI | Yes | Platform | Wave2 | Student ↔ finance linkage (balances visible to authorized roles) |
| SR-F-014 | HIGH | Assistant Accountant | UTC KYEMA | No | Integration | **Wave4** | SchoolPay integration adapter + reconciliation |
| SR-F-015 | HIGH | Assistant Burser | Kasese Technical Institute | Yes | Platform + Report | Wave2 | Real-time fee/payment visibility + quick lookup |
| SR-F-016 | MEDIUM | — | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave2 | Stakeholder access to payment info (role-scoped views) |

---

## Epic E — Staff / HR

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-017 | HIGH | Deputy Chief Head Trainer | ST SIMON PETER'S VTI | Yes | Platform + Report | Wave3 | HR module: staff profiles, contracts, appraisals, reminders, attendance, workload |
| SR-F-018 | HIGH | Coordinator Academics and Training (CAT) | Kasese Technical Institute | No | Platform | Wave3 | Instructor attendance visibility (from attendance module) |
| SR-F-019 | MEDIUM | — | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave3 | Staff status + payment correctness support |

---

## Epic F — Assessment / Marks

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-020 | HIGH | Registrar, Instructors, Head of Departments | UTC KYEMA | Yes | Platform | Wave2 | Instructor mark entry + submission |
| SR-F-021 | HIGH | Instructor, Registrar | UTC KYEMA | Yes | Platform | Wave2 | Marks visibility for HOD/Registrar |
| SR-F-022 | HIGH | Registrar | UTC KYEMA | Yes | Platform | Wave2 | Marks audit trail (who changed what, when) |
| SR-F-023 | HIGH | Cordinator Academics and Training | Kasese Technical Institute | Yes | Platform + Report | Wave3 | Track industrial training participation and progress |
| SR-F-024 | HIGH | Registrar | ST JOSEPH'S TECHNICAL INSTITUE - VIRIKA | Yes | Platform | Wave2 | Paperless marks workflow (entry → review → publish) |
| SR-F-025 | MEDIUM | — | Milennium Business School | Unknown | Backlog (clarify) | — | SRD entry empty → needs clarification |
| SR-F-026 | MEDIUM | Instructor, Liason Officer | UTC KYEMA | Yes | Platform | Wave3 | Field placement tracking (placements + change history) |
| SR-F-027 | MEDIUM | Head of Department (HoD) | Kasese Technical Institute | Yes | Report | Wave3 | Termly performance analytics (cohorts, distributions) |

---

## Epic G — Reporting / Evaluations

| Req ID | Priority | Stakeholder | Source VTIs | Shared? | Delivery Type | Wave | What it becomes in AMIS |
|---|---|---|---|---|---|---|---|
| SR-F-031 | HIGH | Instructor, Liason Officer | UTC KYEMA | No | Platform + Report | Wave3 | Industrial training reporting (students + supervisors) |
| SR-F-032 | HIGH | Principal | Kasese Technical Institute | No | Platform | Wave3 | Teacher evaluation by students (surveys + reports) |
| SR-F-033 | MEDIUM | Registrar | ST SIMON PETER'S VTI | Yes | Platform + Report | Wave3 | Instructor reports (weekly/monthly templates + reminders) |

---

## Non-Functional Requirements → Engineering Standards

| NFR ID | Priority | Requirement | Implementation Hook |
|---|---|---|---|
| SR-NF-001 | HIGH | System should support the 3 click principle | UX acceptance criteria + search + “360 student view” |
| SR-NF-002 | HIGH | Strong password stored in hashed format | ✅ Implemented in Phase 3 (bcrypt + token hashing) |
| SR-NF-003 | HIGH | Load records under 5 seconds under normal load | Perf budget + pagination + indexing |
| SR-NF-004 | HIGH | Provide data within first 3 clicks | Same as SR-NF-001 |

---

## Data Requirements (DS-###) → Migration Workstreams

### Workstream 1: Student master data
- DS-001, DS-003, DS-005, DS-010, DS-012

### Workstream 2: Marks / results
- DS-002, DS-004, DS-007

### Workstream 3: Admissions lists
- DS-006

### Workstream 4: Finance
- DS-011, DS-014 (+ SchoolPay integration Wave4)

### Workstream 5: Stores / procurement
- DS-008, DS-009

---

## Notes / Gaps to Clarify

- **SR-F-009** and **SR-F-025** are empty in the SRD and need clarification before scheduling.
- “Shared?” flags should be confirmed once all individual VTI SRDs are available side-by-side.
- Attendance requirements are present in UTC Kyema documents but not in the Combined SRD list yet; add as a future SR-F entry when approved.