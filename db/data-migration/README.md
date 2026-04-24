# KTI Data Migration Toolkit

Imports source data from Kasese Technical Institute into AMIS.  
All scripts run with Node.js built-ins only — no extra npm packages required.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | Must be on PATH |
| PowerShell 5.1+ | Used internally by `lib/xlsx.js` and `lib/docx.js` to unzip `.xlsx`/`.docx` |
| PostgreSQL running | Via `docker compose up -d` |
| `DATABASE_URL` set | Or a `.env` at repo root — see below |
| Migrations applied | Run `dbmate up` before any phase |

### DATABASE_URL

Set in `.env` at the repo root (same file dbmate uses):

```
DATABASE_URL=postgres://amis_app:yourpassword@localhost:5432/amis_dev
```

Or export it in your shell:

```powershell
$env:DATABASE_URL = "postgres://amis_app:yourpassword@localhost:5432/amis_dev"
```

---

## Raw Data Files

Place all source files in `db/data-migration/kti/raw/` (gitignored):

| File | Used by |
|---|---|
| `KASESE TECH INST GENERAL INFORMATION.xlsx` | phases 1–5 |
| `Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx` | phase 3 |

---

## Run Order

Always run in sequence — each phase depends on data from the previous one.

```powershell
# 1. Apply all pending DB migrations
dbmate up

# 2. Seed tenant master data (programmes, grading, fees, staff)
node db/data-migration/kti/phase1-seed.js --dry-run   # preview
node db/data-migration/kti/phase1-seed.js             # commit

# 3. Import 189 students from Sheet4
node db/data-migration/kti/phase2-students.js --dry-run
node db/data-migration/kti/phase2-students.js

# 4. Import marks (Sheet5 + NCBC CAD workbook)
node db/data-migration/kti/phase3-marks.js --dry-run
node db/data-migration/kti/phase3-marks.js

# 5. Import fee payment records (Sheet7, fuzzy name match)
node db/data-migration/kti/phase4-fees.js --dry-run
node db/data-migration/kti/phase4-fees.js
# → Review phase4-review.json for low-confidence matches before confirming

# 6. Import full course catalogue (Sheet3, all 5 programmes)
node db/data-migration/kti/phase5-courses.js --dry-run
node db/data-migration/kti/phase5-courses.js
```

All scripts accept:
- `--dry-run` — reads data, prints what would happen, writes nothing to DB
- `--verbose` — prints one line per record

---

## Phase Details

### Phase 1 — Tenant & Master Data (`phase1-seed.js`)
Seeds:
- KTI tenant record (with TVET/CoVE regulatory fields)
- 10 programmes (NCBC, NCES, NCAP, NCAM, NCPL + short courses)
- 7-band grading scale (UVTAB standard: D1–F9)
- 6 fee structure lines (tuition + levies per programme level)
- 5 staff users with roles and profiles

Temporary password for all seeded staff: **`KTI@Change2026!`**  
Staff must change this on first login.

### Phase 2 — Students (`phase2-students.js`)
- Source: Sheet4 "STUDENTS REGISTER" (189 rows)
- Upserts by `registration_number`
- Extracts programme code from verbose programme string (regex `^([A-Z]{2,6})`)
- Converts Excel date serials to ISO dates for DOB

### Phase 3 — Marks (`phase3-marks.js`)
- Source 1: Sheet5 "MARKS" (matched by `registration_number`)
- Source 2: NCBC CAD workbook (matched by `uvtab_reg_number`, rows 15+)
- Creates a `mark_submission` record per course/programme/year/term group, then inserts `mark_entries`

### Phase 4 — Fee Payments (`phase4-fees.js`)
- Source: Sheet7 "FEES RECORDS" (17 rows)
- Linked by student name only — uses fuzzy token-overlap matching
- Default threshold: `0.8` (override with `--threshold=0.6`)
- Unmatched + low-confidence rows written to `phase4-review.json`
- Review that file and re-run with adjusted threshold if needed

### Phase 5 — Course Catalogue (`phase5-courses.js`)
- Source: Sheet3 "COURSE PROGRAMME" (133 rows, all 5 programmes)
- Detects programme from code prefix: `VCAP*`→NCAP, `NCES*`→NCES, `NCAM*`→NCAM, `NCPL*`→NCPL, `NCBC*`→NCBC
- Shared `TC*` modules (TCCA, TCCS, TCBE, TCTM) inherit the current programme context — inserted once per first occurrence (ON CONFLICT DO NOTHING)
- Infers `course_type` from title suffix: `(THEORY)`→theory, `(PRACT*)`/`REAL LIFE`/`FARM ATTACH`→practical, else→both

---

## Library Reference (`lib/`)

| Module | Key exports |
|---|---|
| `xlsx.js` | `readXlsx(path)` → `{sheetName, rows}[]` |
| `docx.js` | `readDocx(path)` → `string[]` of paragraphs |
| `normalise.js` | `parseName`, `normalisePhone`, `excelDateToISO`, `normaliseGender`, `fuzzyNameScore`, `matchStudent`, `titleCase` |
| `db.js` | `query(sql, params)`, `withTenant(tid, cb)`, `getTenantId(slug)`, `end()` |
| `report.js` | `new Report(phase, tenant)` → `.inserted()`, `.updated()`, `.skipped()`, `.error()`, `.print()` |

---

## Known Gaps (post-migration tasks)

| Gap | Detail |
|---|---|
| G1 — UVTAB reg numbers | `uvtab_reg_number` populated only from NCBC CAD sheet. Full UVTAB export needed to populate all students. |
| G2 — Incomplete marks | Sheet5 has 56 rows, not all 189 students have marks. Remaining marks pending from KTI. |
| G3 — Fee coverage | Only 17 fee rows provided (partial register). Full fee ledger not in source files. |
| G4 — Shared TC* programmes | TC* courses inserted under first programme encountered. May need explicit programme assignments once curriculum is confirmed with KTI. |
