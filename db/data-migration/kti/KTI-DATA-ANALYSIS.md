# KTI Data Analysis — Migration Mapping
**Institution**: Kasese Technical Institute (KTI)  
**Source files**: `db/data-migration/kti/raw/`  
**Date analysed**: 2026-04-22  
**Analyst**: GitHub Copilot  

---

## 1. Source Files Inventory

| File | Type | Content |
|------|------|---------|
| `KASESE TECH INST GENERAL INFORMATION.xlsx` | Excel (16 sheets) | Master data workbook: institution profile, programmes, courses, students, marks, grades, fees, staff |
| `Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx` | Excel | UVTAB coursework submission sheet for NCBC Year 2, Paper: Computer Aided Drawing |
| `STUDENT data Form at institutional level.docx` | Word | Paper intake form template — fields collected at registration |
| `2026 PRIVATE ADMISSION LETTERS..docx` | Word | Admission letter template for privately sponsored students |
| `APPLICATION FORM.pdf` | PDF | Student application form |
| `COURSE WORK TEMPLATE.pdf` | PDF | UVTAB coursework template |
| `RECEIPT.pdf` | PDF | Fee payment receipt layout |
| `KTI New Logo.jpg` / `.pdf` | Image | Institution logo (colour: Light blue) |

---

## 2. Institution Profile → `platform.tenants`

| KTI Field | Value | AMIS Column |
|-----------|-------|-------------|
| Full institution name | Kasese Technical Institute | `name` |
| Short name | KTI | `slug` |
| Email | kasesetechnicalinstitute@gmail.com | `contact_email` |
| Physical address | Kihara Road, Rukooki Ward, Nyamwamba Division, Kasese Municipality, Kasese District | `address` |
| Official colours | Light blue | `brand_colour` (future) |
| Academic year | 2026/2027 | `current_academic_year` |
| Current term | Term I | `current_term` |
| Motto | "Skill Is Wealth" | `motto` (future) |
| Bank account | 3100045991, Centenary Bank, Kasese Branch | fee payment instructions |

**Action**: INSERT one row into `platform.tenants` with `slug = 'kti'`.  
**Tenant ID** will be the FK for all subsequent inserts.

---

## 3. Programmes → `app.programmes`

5 full National Certificate programmes (2 years each) + 5 short courses:

| Code | Full Name | Department | Duration | Type |
|------|-----------|------------|----------|------|
| NCBC | National Certificate in Building Construction | Building construction | 2 years | National Certificate |
| NCPL | National Certificate in Plumbing | Plumbing | 2 years | National Certificate |
| NCAM | National Certificate in Automotive Mechanics | Automotive | 2 years | National Certificate |
| NCES | National Certificate in Electrical Systems and Maintenance | Electrical | 2 years | National Certificate |
| NCAP | National Certificate in Agriculture Production | Agriculture | 2 years | National Certificate |
| HDC | Hair Dressing and Cosmetology | — | short | Certificate |
| ACR | Air Conditioning and Refrigeration | — | short | Certificate |
| FD | Fashion and Design | — | short | Certificate |
| WLD | Welding | — | short | Certificate |
| BC | Building Construction (short) | — | short | Certificate |

**Action**: INSERT 10 rows into `app.programmes` scoped to KTI tenant.

---

## 4. Course Catalogue → `app.courses`

Two complete programme curricula are in the workbook (NCAP and NCES). Each course has:

| Source Column | AMIS Column |
|---------------|-------------|
| Course name | `course_name` |
| Course code | `course_code` |
| Programme belonging | `programme_code` → FK to `app.programmes` |
| Year/level | `year_of_study` |
| Term/semester | `term` |
| Credit units | `credit_units` |

**NCAP sample** (Agriculture, Year 1 Sem 1):
- VCAP 111 — Land Management and Crop Production (Theory)
- VCAP 112 — Land Management and Crop Production (Practical)
- VCAP 113 — Land Management and Crop Production (Real Life Project)
- VCAP 114 — Land Management and Crop Production (Farm Attachment)
- VCAP 121 — Basic Science, Occupational Safety & Health (Theory)
- VCAP 122 — Basic Science, Occupational Safety & Health (Practical)
- ... (extends through Year 2 Sem 2)

**NCES sample** (Electrical, Year 1 Sem 1):
- NCES 111 — Domestic Electrical Installation (Theory)
- NCES 112 — Domestic Electrical Installation (Practice)
- NCES 113 — Domestic Electrical Installation (Real Life Project)
- NCES 102 — Electrical Supply Systems
- NCES 101 — Electrical Installation Science
- NCES 121 — Solar PV Systems (Theory/Practice/Project)
- TCTM 101 — Applied Technicians Mathematics I
- TCCA 101 — Computer Application
- TCCS 101 — Life Skills
- ... (extends through Year 2 Sem 2)

**⚠️ Gap**: NCBC, NCPL, NCAM full course catalogues not in the general workbook —  
only NCAP and NCES are complete. The NCBC marks file shows paper codes but not the full catalogue.  
→ Will need supplemental data from KTI for the other 3 programmes.

---

## 5. Students Register → `app.students`

**Volume**: **189 student records** (sheet4, rows 2–190)  
**Academic Year**: 2025/2026  
**Status**: All records show `Active`

### Column Mapping

| Source Col | Source Header | AMIS Column | Notes |
|------------|---------------|-------------|-------|
| A | student Reg.number | `registration_number` | Format: `UVT212/U/25/M/NCES/0313` |
| B | First Name | `first_name` | Sometimes includes surname (e.g., "BWAMBALE Festo") |
| C | Last name | `last_name` | Often blank when surname is in column B |
| D | Other name | `other_names` | Middle/additional names |
| E | Gender | `gender` | Values: Male / Female |
| F | Date of Birth | `date_of_birth` | **Mostly blank** — major gap |
| G | National ID/NIN | `nin` | Mostly blank |
| H | phone number | `phone` | Some missing / malformed (e.g., "340") |
| I | EMAIL | `email` | Mostly blank |
| J | District of Origin | `district_of_origin` | Non-standard casing (kasese, Bunyangabu) |
| K | Next of kin Name | `next_of_kin_name` | Mostly blank |
| L | Next of kin phone | `next_of_kin_phone` | Mostly blank |
| M | Programme | `programme_code` | Format: `NCES-M-National Certificate in ...` → extract prefix |
| N | Intake Year | `intake_year` | `2025/2026` |
| O | Enrolled status | `is_active` | `Active` → `true` |
| P | Sponsorship | `sponsorship` | `Government` / `Private` |

### Three Numbering Systems (Domain Clarification)

KTI students carry **three distinct numbers** from three different bodies:

| # | Number | Issued by | When | DB Column | Source in migration |
|---|--------|-----------|------|-----------|---------------------|
| 1 | **TVET Admission Number** | TVET (Ministry) | At government admission | `admission_number` | Physical document only — manual entry by staff |
| 2 | **VTI Registration Number** | KTI (the school) | When student enrols | `registration_number` | Sheet4 column A (`UVT212/U/25/M/NCES/0313`) |
| 3 | **UVTAB Exam Number** | UVTAB (exam board) | When student registers for assessment | `uvtab_reg_number` | NCBC CAD sheet column B (`UBT212/2024/T/C/M/0081`) |

**VTI Registration Number format** (Sheet4 column A — what was imported):
```
UVT212/U/25/M/NCES/0313
│      │  │  │  │    └── serial number
│      │  │  │  └─────── programme code
│      │  │  └────────── M = male / F = female
│      │  └───────────── year enrolled (2025)
│      └──────────────── U = Uganda
└─────────────────────── UVT212 = KTI's UVTAB centre code
```

> **TVET Admission Number**: This number is on the physical admission letter issued by the Ministry/TVET body. KTI does not have a digital export of these — staff must enter them manually via the student record form. The `admission_number` column in `app.students` already exists for this purpose.

> **UVTAB Exam Number**: Used only on UVTAB submission sheets (e.g. `UBT212/2024/T/C/M/0081`). The `uvtab_reg_number` column in `app.students` already exists. Populated when importing UVTAB coursework files.

> **Admin Studio note**: Differences in numbering conventions across VTIs are exactly what the Admin Studio configuration system is designed for — each institution can customise their student dataset fields and labels without schema changes.

### Data Quality Issues

| Issue | Affected Field | Resolution |
|-------|----------------|------------|
| Date of Birth mostly blank | `date_of_birth` | Insert NULL; KTI to complete during onboarding |
| NIN mostly blank | `nin` | Insert NULL; NIRA verification pending |
| Names in wrong columns | `first_name`/`last_name` | Parse: if C blank, split B by space — surname = first token |
| Phone "340" | `phone` | Sanitise: skip if < 9 digits |
| Email mostly blank | `email` | Insert NULL |
| Next of kin mostly blank | `next_of_kin_name/phone` | Insert NULL |
| Gender: "Male" for female names | `gender` | Manual review; import as-is, flag for correction |
| Programme column is verbose | `programme_code` | Extract prefix before first `-` (e.g., `NCES`) |
| District case-inconsistent | `district_of_origin` | Normalise to title case |

---

## 6. Marks / Coursework → `app.mark_entries`

**Volume**: 56 rows in the general workbook sheet5  
**NCBC CAD file**: 26 students × 1 paper = additional 26 records

### Column Mapping (General Workbook Sheet5)

| Source Col | Source Header | AMIS Column |
|------------|---------------|-------------|
| A | Registration number | `student_reg_number` (note: uses UVT format) |
| B | Student Name | (not stored — derive from students table) |
| D | course Name/code | `course_code` |
| E | Programme | `programme_code` |
| F | Year | `year_of_study` |
| G | Term/semester | `term` |
| H | Academic Year | `academic_year` |
| I | Score/mark | `score` |
| J | Maximum score | `max_score` |
| K | Assessment type | `assessment_type` (Coursework) |
| L | Grade | `grade` (can be computed from grading scale) |
| M | Remarks | `remarks` |

### NCBC UVTAB Coursework Sheet (CAD Paper)

This is the **official UVTAB submission format**:
```
Header:
  Centre: KASESE TECHNICAL INSTITUTE
  Programme: NATIONAL CERTIFICATE IN BUILDING AND CONSTRUCTION
  Paper: COMPUTER AIDED BUILDING DRAWING
  Year of Exam: 2025, Year of Study: TWO

Score columns (out of proportional weights):
  E: Assignment 1 (5%)
  F: Assignment 2 (5%)
  G: — (10%)
  H: Assignment 3 (10%)
  J: Assignment 4 (25%)  ← dates in row 15 are submission dates
  K: Internal total (80% weighting)
  L: Final % score

Student rows (16–41):
  B: UVTAB Registration No. (UBT212/2024/T/C/M/XXXX)
  C: Surname
  D: Other names
```

**Reg number systems**: UVTAB marks use UVTAB numbers (`UBT212` prefix), students register uses VTI numbers (`UVT212` prefix) — see Three Numbering Systems section above.

- `uvtab_reg_number` column **already exists** in `app.students` ✅
- Phase 3 import: matched by stripping prefix/suffix tokens; 56 inserted, 21 NCBC UVTAB rows skipped (UVTAB numbers not yet linked to student records)
- Resolution path: populate `uvtab_reg_number` for NCBC students when UVTAB portal export is available (see Gap G4)

---

## 7. Grading Scale → `app.grading_scales`

KTI uses a 7-band letter grade scale:

| % Range | Letter | Grade Point |
|---------|--------|-------------|
| 80–100 | A | 5.0 |
| 75–79.9 | B+ | 4.5 |
| 70–74.9 | B | 4.0 |
| 65–69.9 | B- | 3.5 |
| 60–64.9 | C+ | 3.0 |
| (implied) 50–59.9 | C | 2.0 |
| (implied) < 50 | F | 0.0 |

**Action**: INSERT grading scale record for KTI tenant. Lower bands (C, F) need confirmation.

---

## 8. Fee Records → `app.payments`

**Volume**: 17 rows in sheet7 (sample — not full register)  
**Currency**: UGX  
**Fee types**: Tuition  
**Partial payments**: Yes (50%, 75%, 100%) per the FEE COLLECTION sheet

### Column Mapping

| Source Col | Source Header | AMIS Column | Notes |
|------------|---------------|-------------|-------|
| A | Student name | → fuzzy match to `app.students.first_name + last_name` | **No reg number — name-only link** |
| B | Amount Paid | `amount` | In UGX, e.g. 350,000 |
| C | Currency | `currency` | Always UGX |
| D | Payment reference/receipt number | `receipt_number` | e.g. 53946785 |
| E | Date of Payment | `payment_date` | Excel serial — convert to ISO date |
| F | Payment Method / Term | `term` | "One" = Term 1 (misleading header) |
| G | Sponsorship | `sponsorship` | Private / Government |
| H | Department / Programme | `programme_code` | e.g. NCPL |
| I | Fees type | `fee_type` | Tuition |

**⚠️ Critical issue**: Fee records are linked by **student name only**, not by registration number.  
Resolution: Normalise names → fuzzy match → manual review of mismatches.

### Fee Structure (from kaseseyp.ac.ug — authoritative source)

**Section A — NCES, NCAM, NCBC** (Electrical, Automotive, Building):

| Item | Govt Sponsored | Self Sponsored (Boarding) | Day Scholar | Frequency |
|------|----------------|--------------------------|-------------|-----------|
| Admission Fee | UGX 10,000 | UGX 10,000 | UGX 10,000 | Once per programme |
| Tuition, Development & Utilities | UGX 386,000 | UGX 689,000 | UGX 539,000 | Per term |
| Uniform | UGX 65,000 | UGX 65,000 | UGX 65,000 | Once per programme |
| ICT / LAN | UGX 20,000 | UGX 20,000 | UGX 20,000 | Once per academic year |
| Guild Fee | UGX 15,000 | UGX 15,000 | UGX 15,000 | Once per academic year |
| Identity Card | UGX 15,000 | UGX 15,000 | UGX 15,000 | Once per programme |
| UBTEB Registration Fee | — | UGX 120,000 | UGX 120,000 | Once per academic year |

**Section B — NCPL** (Plumbing):

| Item | Self Sponsored (Boarding) | Day Scholar | Frequency |
|------|--------------------------|-------------|-----------|
| Admission Fee | UGX 10,000 | UGX 10,000 | Once per programme |
| Tuition and Utilities | UGX 564,000 | UGX 464,000 | Per term |
| Uniform | UGX 65,000 | UGX 65,000 | Once per programme |
| ICT / LAN | UGX 20,000 | UGX 20,000 | Once per academic year |
| Guild Fee | UGX 15,000 | UGX 15,000 | Once per academic year |
| Identity Card | UGX 10,000 | UGX 10,000 | Once per programme |
| UBTEB Registration Fee | UGX 120,000 | UGX 120,000 | Once per academic year |

> **Note**: NCAP fees not listed separately on the website — assume Section A rates apply until KTI confirms.

**Action**: Seed `app.fee_structures` with these values for KTI tenant after first academic year is created.

---

## 9. Staff Users → `platform.users`

**Volume**: 5 named staff + additional rows (likely more staff further down sheet8)

| Name | Email | Phone | AMIS Role | Department |
|------|-------|-------|-----------|------------|
| Agaba Generous | agabag56@gmail.com | 0779803595 | `admin` | Administration |
| Olwoch Dickens Koma | olwochdkoma@gmail.com | 0775000414 | `dean` (principal / view-all) | Principal |
| Azairwe Fortunate | fortunateazairwe032@gmail.com | 0785010834 | `registrar` | Registry |
| Muhindo Samuel | muhindosamuel0@gmail.com | 0787176354 | `finance` | Finance |
| Twesigye Isaac | twesigyeisa@gmail.com | 0784975857 | `hod` | Building construction |

**Role mapping**:
| KTI Description | AMIS Role |
|-----------------|-----------|
| Full access – admissions, config, user mgmt | `admin` |
| View-only access to all data | `dean` |
| Student registration, coursework marks, UVTAB results | `registrar` |
| Record/import fees, view fee records | `finance` |
| Review/approve marks, view dept data, update timetable | `hod` |

**Action**: INSERT into `platform.users` + `platform.user_roles` scoped to KTI tenant.  
Temporary passwords to be set; users must change on first login.

---

## 10. Document Layouts — Print Templates

### 10.1 Student Data Intake Form
Collected fields (paper form → maps to AMIS student record):
- Personal: First Name, Last Name, Phone, DOB, Class/Course, Year of Joining, Day/Boarding
- Region (Western/Eastern/Central/Northern), District, Physical Address
- **2× Parent/Guardian**: Name + Phone
- Verification: Accounts sign-off + Deputy Admin & Finance sign-off

**→ Future UI feature**: Student intake form should mirror these fields exactly.

### 10.2 Admission Letter Template
Structure:
```
[KTI Letterhead with logo + motto "Skill Is Wealth"]
[Republic of Uganda flag positioning]
[Student Name, Admission Number, Reference]

PRIVATE SPONSORED ADMISSION TO A NATIONAL CERTIFICATE COURSE
FOR THE ACADEMIC YEAR [YEAR]

- Programme admitted to: [PROGRAMME_NAME]
- Reporting date: [DATE]
- Fee structure table (boarding vs day, per term vs once-off)
- Institutional requirements checklist (cement bag, ream of paper, etc.)
- Training equipment list (by programme)
- Personal requirements
- Signature line: PRINCIPAL name + phone
- Student acknowledgement section
```

**→ Future print module**: `GET /students/:id/admission-letter` PDF endpoint.  
Bank: **Account No. 3100045991, Centenary Bank, Kasese Branch** (in the name of "Kasese Youth Institution").

### 10.3 UVTAB Coursework Submission Sheet
Format:
```
UGANDA VOCATIONAL AND TECHNICAL ASSESSMENT BOARD
COURSE WORK SUBMISSION FOR [EXAM_PERIOD]

Year of Examinations: [YEAR]  Year: [ONE/TWO]
Centre Name: [INSTITUTION_NAME]
Course Name: [PROGRAMME_FULL_NAME]
Paper Name: [PAPER_NAME]

[Weight row - assignment percentages]
[Date row - submission dates per assignment]

S/N | REG NO. | SURNAME | OTHER NAMES | Asgn1 | Asgn2 | Asgn3 | Asgn4 | InternalTotal | FinalScore%

[Student rows]

Name of Instructor: [NAME]  Tel: [PHONE]
Name of Head of Center: [NAME]
```

**→ Future export feature**: `GET /marks/uvtab-export?programme=NCBC&paper=NCBC11&year=2` → Excel/PDF.

### 10.4 Payment Receipt
PDF receipt exists — details its layout (receipt number, student name, amount, term, date, cashier).  
**→ Future feature**: `GET /payments/:id/receipt` PDF endpoint.

---

## 11. Migration Action Plan

### Phase 1 — Seed Institution ✅ COMPLETE
1. ✅ KTI tenant updated → `platform.tenants`
2. ✅ 10 programmes inserted → `app.programmes`
3. ✅ Grading scale + **12 grade boundaries** inserted → `app.grading_scales` + `app.grade_boundaries`
   - Fixed: replaced the original 7 incorrect bands with all 12 correct bands (A, B+, B, B-, C+, C, C-, D+, D, D-, E, MS)
   - CGPA classification: First Class ≥4.4, Second Upper 3.6–4.39, Second Lower 2.8–3.59, Pass 2.0–2.79, Fail <2.0
4. ✅ 5 staff users + profiles inserted → `platform.users` + `app.staff_profiles`
5. ⏭️ Fee structures **deferred** — `app.fee_structures` requires `academic_year_id` (NOT NULL FK); KTI fee types don't match CHECK constraint. Enter via Admin Studio UI after first academic year is created.

### Phase 2 — Student Import ✅ COMPLETE
6. ✅ 189 students inserted → `app.students`
   - Names normalised (surname-in-B parsed)
   - Programme code extracted from verbose string
   - Phone sanitised
   - `registration_number` (VTI number) populated; `admission_number` (TVET) left NULL for manual entry

### Phase 3 — Marks Import ✅ COMPLETE
7. ✅ 56 general coursework rows inserted → `app.mark_entries`
8. ✅ 21 NCBC CAD marks inserted (previously skipped) — resolved by Phase 6 below

### Phase 6 — NCBC 2024/2025 Cohort ✅ COMPLETE
11. ✅ 26 NCBC CAD Year-2 students inserted → `app.students` (`is_active=false`, `intake_year='2024/2025'`)
    - UVTAB number (`UBT212/...`) used as both `registration_number` and `uvtab_reg_number`
    - phase3 re-run: 21 CAD marks inserted (5 rows had no scores — correctly skipped)
    - Script: `phase6-ncbc-cohort.js`

### Phase 4 — Fee Records Import ✅ COMPLETE
9. ✅ 17 payment records inserted → `app.payments` (name-based fuzzy match)

### Phase 5 — Course Catalogue ✅ COMPLETE
10. ✅ NCAP + NCES courses inserted → `app.courses` (104 inserted, 10 skipped as duplicates)

### Remaining Manual Steps
- [ ] Staff set their own passwords on first login
- [ ] Create first Academic Year in Admin Studio → then enter fee structures
- [ ] KTI staff enter TVET admission numbers per student (physical document lookup)
- [ ] Populate `uvtab_reg_number` for students when UVTAB portal export available
- [ ] Complete course catalogues for NCBC, NCPL, NCAM when KTI provides data (Gap G1)

---

## 12. Gaps & Open Questions

| # | Gap | Owner | Priority |
|---|-----|-------|----------|
| G1 | NCBC, NCPL, NCAM full course catalogues missing | KTI to provide | High |
| G2 | DOB, NIN mostly blank for 189 students | KTI to complete | Medium |
| G3 | Fee records use name-only (no reg no) | Manual review after import | High |
| G4 | ~~NCBC CAD marks (21 rows): UVTAB 2024-cohort students not in 2025-intake register~~ | **RESOLVED** — 26 students added as 2024/2025 cohort; 21 marks imported | ✅ |
| G5 | Full fee records — only 17 of likely 189+ rows | KTI to provide complete export | High |
| G6 | ~~Bottom bands of grading scale (C and F) not shown~~ | **RESOLVED** — all 12 bands now correctly seeded (fix-grade-bands.js) | ✅ |
| G7 | Short course students not in register | KTI to confirm if in same sheet | Low |
| G8 | ~~`uvtab_reg_number` column needed~~ | **RESOLVED** — column already exists in `app.students` | ✅ |
| G9 | Gender inconsistencies (female names marked Male) | Manual review | Low |
