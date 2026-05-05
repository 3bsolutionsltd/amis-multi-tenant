# UTC Kyema — Source Data Audit Report

**Institution:** Uganda Technical College — Kyema  
**Audit Date:** _[fill in date]_  
**Auditor:** _[fill in name / role]_  
**Purpose:** Document all source data provided by UTC Kyema before migration.

---

## Status

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Master data (tenant, programmes, staff) | ✅ Ready (known from analysis) | Static data, no source files needed |
| Phase 2 — Students | ⏳ Awaiting source file | UTC Kyema to provide Excel/CSV |
| Phase 3 — Marks | ⏳ Awaiting source file | Per-course result sheets |
| Phase 4 — Fees | ⏳ Awaiting source file | Fee payment register |

---

## 1. Institution Profile (confirmed)

| Item | Value |
|---|---|
| Full name | Uganda Technical College — Kyema |
| Slug | `utc-kyema` |
| Address | 5 KM Masindi–Kiryandongo Rd, P.O. Box 473 Masindi, Uganda |
| Phone | +256 465 423 396 |
| Email | ugatechkyema@yahoo.com |
| Website | www.utckyema.ac.ug |
| Current intake | 2026/2027 |

---

## 2. Programmes (confirmed)

| Code | Full Name | Duration | Awarding Body |
|---|---|---|---|
| NCBC | National Certificate in Building Construction | 2 years | UVTAB |
| NCES | National Certificate in Electrical Systems and Management | 2 years | UVTAB |
| NCAM | National Certificate in Automotive Mechanics | 2 years | UVTAB |
| NCP | National Certificate in Plumbing | 2 years | UVTAB |
| NCWF | National Certificate in Welding and Fabrication | 2 years | UVTAB |

---

## 3. Grading Scale (to confirm with UTC Kyema)

| Grade | Min % | Max % | Label | Points | Notes |
|---|---|---|---|---|---|
| D1 | 80 | 100 | Distinction | 4 | Same as KTI — confirm with UTC Kyema |
| D2 | 70 | 79 | Distinction | 3 | |
| C3 | 60 | 69 | Credit | 2.5 | |
| C4 | 55 | 59 | Credit | 2 | |
| P5 | 50 | 54 | Pass | 1.5 | |
| P6 | 45 | 49 | Pass | 1 | |
| F9 | 0 | 44 | Fail | 0 | |

> **Action:** Confirm UVTAB standard grading bands with UTC Kyema registrar.

---

## 4. Fee Structure (amounts TBC)

| Fee Type | Government | Private | Notes |
|---|---|---|---|
| Tuition fee (per term) | 0 (TBC) | 0 (TBC) | Configurable in Admin Studio |
| UBTEB fee (per term) | 0 (TBC) | 0 (TBC) | |
| Guild fee (per term) | 0 (TBC) | 0 (TBC) | |
| Minimum payment threshold | — | 80% of tuition + UBTEB | Set by UTC Kyema policy |

> **Action:** UTC Kyema to provide fee schedule for 2026/2027 intake.

---

## 5. Source Files Inventory

Fill this section when UTC Kyema provides data files.

| File | Format | Records | Columns | Quality Notes |
|---|---|---|---|---|
| _[filename.xlsx]_ | Excel | — | — | _[e.g. missing phone column in 12 rows]_ |
| | | | | |

---

## 6. Student Register Mapping

_(Fill when student Excel is provided)_

| Excel Column | AMIS Field | Table | Notes |
|---|---|---|---|
| _[column name]_ | `last_name` | `app.students` | |
| _[column name]_ | `first_name` | `app.students` | |
| _[column name]_ | `gender` | `app.students` | |
| _[column name]_ | `dob` | `app.students` | Format: DD/MM/YYYY? |
| _[column name]_ | `programme_code` | `app.students` | Must map to NCBC/NCES/etc. |
| _[column name]_ | `sponsorship_type` | `app.students` | Government / Private |
| _[column name]_ | `intake` | `app.students` | e.g. 2026 |

---

## 7. Data Quality Issues Found

_(Document issues discovered during audit — fill during review)_

| Row / ID | Column | Issue | Resolution |
|---|---|---|---|
| — | — | — | — |

---

## 8. Staff List (to collect from UTC Kyema)

| Name | Role in UTC Kyema | AMIS Role | Email |
|---|---|---|---|
| _[Academic Registrar name]_ | Academic Registrar | `registrar` | |
| _[Accounts name]_ | Accounts Officer | `finance` | |
| _[HOD NCBC]_ | Head of Dept | `hod` | |
| _[HOD NCES]_ | Head of Dept | `hod` | |
| _[HOD NCAM]_ | Head of Dept | `hod` | |
| _[HOD NCP]_ | Head of Dept | `hod` | |
| _[HOD NCWF]_ | Head of Dept | `hod` | |
| _[Dean name]_ | Dean of Students | `dean` | |
| _[Principal name]_ | Principal | `principal` | |
| _[ICT Technician name]_ | ICT Technician | `admin` | |

---

## 9. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| UTC Kyema data contact | | | |
| AMIS migration lead | | | |
| QA review | | | |
