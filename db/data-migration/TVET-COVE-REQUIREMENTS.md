# TVET Act & CoVE Framework — AMIS Data Requirements
_Derived from `tvet_cove_act.docx` | Applies to ALL 5 VTIs_

**VTIs in scope**: Milennium, Simon Peter, Kyema/UTC, Kasese TI (KTI), Virika

---

## Summary of the Governing Document

The document is a **data collection guide** produced for all VTIs under Uganda's TVET Act and Centre of Vocational Excellence (CoVE) framework. It maps **what data must be held**, **which regulatory body requires it**, and **how it should integrate into AMIS**. It covers 10 thematic areas.

---

## Section-by-Section Requirements → AMIS Mapping

### 1. Institutional Identity, Licensing & Accreditation
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Institution legal name | TVET Act | `platform.tenants.name` | ✅ Exists |
| Ownership type (public/private) | TVET Act | `platform.tenants.metadata ->> 'ownership_type'` | ⚠️ Use extension JSON |
| Physical location (district) | TVET Act | `platform.tenants.address` | ✅ `address` added in migration 29 |
| Land ownership / lease docs | TVET Act | Document upload (future) | ❌ Not in AMIS schema |
| License number, issue date, status | TVET Act | `platform.tenants` | ❌ Missing: `license_number`, `license_date`, `license_status` |
| Accredited programme name | TVET Act, CoVE | `app.programmes.name` | ✅ Exists |
| Programme qualification level | TVET Act, CoVE | `app.programmes.level` | ✅ Exists |
| Programme accreditation status | TVET Act | `app.programmes` | ❌ Missing: `accreditation_status` |
| Approved intake capacity | TVET Act, CoVE | `app.programmes` | ❌ Missing: `intake_capacity` |

**AMIS Note**: Accreditation data should be programme-linked, not free text. Support document upload with expiry dates.

---

### 2. Governance & Management
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Board composition, mandates, term dates | TVET Act | Not currently in AMIS | ❌ Future module |
| Meeting logs (date, quorum, minutes) | TVET Act | Not currently in AMIS | ❌ Future module |
| Management resolutions (status-based) | TVET Act | Not currently in AMIS | ❌ Future module |

**AMIS Note**: Low priority for migration; capture as documents initially.

---

### 3. Learner Enrolment & Participation
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Learner ID / full name | TVET Act, CoVE | `app.students.id`, `full_name` | ✅ Exists |
| Sex | TVET Act, CoVE | `app.students.gender` | ✅ Exists |
| Age / date of birth | TVET Act, CoVE | `app.students.date_of_birth` | ✅ Exists |
| Vulnerability category | CoVE | `app.students.extension ->> 'vulnerability'` | ⚠️ Use JSONB extension |
| Entry qualification | TVET Act | `app.students` | ❌ Missing: `entry_qualification` |
| Programme / trade enrolled | TVET Act, CoVE | `app.term_registrations.programme_id` | ✅ Via registrations |
| Mode (formal / nonformal) | CoVE | `app.programmes.mode` | ❌ Missing: `mode` on programmes |
| Date of admission / intake | TVET Act, CoVE | `app.students.created_at` / `admission_applications` | ⚠️ Should use explicit `admission_date` |
| Enrolment status (active/dropped/completed) | CoVE | `app.students.is_active` + `dropout_reason` | ✅ Exists |
| Reason for dropout | CoVE | `app.students.dropout_reason` | ✅ Exists (migration 23) |
| Attendance records | TVET Act | `app.attendance` | ✅ Exists (migration 32) |
| Intake size per programme | CoVE | Derived from `app.term_registrations` | ✅ Derivable |

**AMIS Note**: `entry_qualification` and explicit `admission_date` are missing from `app.students`.

---

### 4. Completion, Assessment & Certification
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Completion record (date, type, status) | TVET Act, CoVE | `app.students.is_active` + dropout fields | ⚠️ Needs explicit `completion_date` |
| Assessment registration number | TVET Act | `app.students.uvtab_reg_number` | ❌ Missing (Gap G8 from KTI analysis) |
| Assessment results | TVET Act, CoVE | `app.mark_entries` | ✅ Exists |
| Awarding body (e.g. UVTAB) | TVET Act, CoVE | `app.students` or programme | ❌ Missing: `awarding_body` ref |
| Reason for non-certification | CoVE | `app.students` | ❌ Missing: `non_cert_reason` |

---

### 5. Work-Based Learning (WBL)
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| WBL participation (Yes/No) | CoVE | `app.it_reports` (industrial training) | ✅ Partial — `it_reports` exists |
| WBL type (internship/apprenticeship/attachment) | CoVE | `app.it_reports` | ⚠️ Check `it_reports` has type field |
| Host organisation | CoVE | `app.it_reports` | ⚠️ Check `it_reports` |
| WBL duration | CoVE | `app.it_reports` | ⚠️ Check `it_reports` |
| Completion status | CoVE | `app.it_reports` | ⚠️ Check `it_reports` |
| Special arrangements for PWD | CoVE | `app.it_reports` | ❌ Missing |

---

### 6. Employer Engagement & Feedback
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Employer registry | CoVE | Not in AMIS | ❌ Future module |
| Type of engagement | CoVE | Not in AMIS | ❌ Future module |
| Active MoU status | CoVE | Not in AMIS | ❌ Future module |
| Employer/customer satisfaction score | CoVE | Not in AMIS | ❌ Future module |

**AMIS Note**: Central employer registry to be built. Low priority for migration.

---

### 7. Trainers & Staff
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Trainer full name / ID | TVET Act, CoVE | `app.staff_profiles` | ✅ Exists |
| Academic level & vocational qualifications | TVET Act, CoVE | `app.staff_profiles` | ❌ Missing: `qualification_level`, `vocational_cert` |
| Andragogy / pedagogy training | TVET Act, CoVE | `app.staff_profiles` | ❌ Missing: `pedagogy_trained` |
| Trainer registration number | TVET Act | `app.staff_profiles` | ❌ Missing: `trainer_reg_number` |
| Training license number & validity | TVET Act | `app.staff_profiles` | ❌ Missing: `license_number`, `license_expiry` |
| CPD participation and trainings | TVET Act, CoVE | `app.staff_appraisals` | ⚠️ `staff_appraisals` is generic — needs dedicated CPD table |
| Industrial experience | CoVE | `app.staff_profiles` | ❌ Missing: `industrial_experience_years` |

**AMIS Note**: Add qualification + licence fields to `app.staff_profiles`. Add `app.staff_cpd` table.

---

### 8. Learning Resources & Equipment
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Equipment inventory (category level) | CoVE | Not in AMIS | ❌ Future module |
| Equipment functionality status | CoVE | Not in AMIS | ❌ Future module |
| Adequacy vs curriculum | CoVE | Not in AMIS | ❌ Future module |

**AMIS Note**: Infrastructure module — low priority for initial migration.

---

### 9. Learner Welfare & Feedback
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Learner satisfaction (aggregated) | CoVE | Not in AMIS | ❌ Future — integrate KoboToolbox |
| Welfare cases & support | CoVE | Not in AMIS | ❌ Future module |

**AMIS Note**: KoboToolbox integration planned. Not blocking migration.

---

### 10. Financial & Production Data
| Required Field | Regulation | AMIS Table / Column | Status |
|---|---|---|---|
| Income sources (fees, production, grants) | TVET Act, CoVE | `app.payments` (fees only) | ⚠️ Only student fees tracked |
| Training with Production (TwP) revenue | TVET Act, CoVE | Not in AMIS | ❌ Missing TwP revenue line |
| 10% levy amount & remittance | TVET Act | Not in AMIS | ❌ Missing |
| Annual financial statements (document) | TVET Act | Not in AMIS | ❌ Document upload future |
| Audited accounts (document) | TVET Act | Not in AMIS | ❌ Document upload future |

**AMIS Note**: Link planned with QuickBooks. AMIS captures summary figures, not full accounting.

---

## Schema Gap Summary (Migration-Critical)

These gaps **must be addressed before migration scripts run** (i.e., require new DB migrations):

### GAP-T1: Missing student fields
`app.students` needs:
- `entry_qualification text` — highest qualification at admission
- `admission_date date` — explicit admission date (vs. `created_at`)
- `uvtab_reg_number text` — UVTAB exam board reg number (Gap G8 from KTI)
- `completion_date date` — date of programme completion
- `non_cert_reason text` — reason for non-certification (CoVE)

### GAP-T2: Missing programme fields
`app.programmes` needs:
- `accreditation_status text` — e.g. 'accredited', 'pending', 'withdrawn'
- `intake_capacity int` — approved cohort size (TVET Act)
- `mode text` — 'formal' | 'nonformal' (CoVE)
- `awarding_body text` — e.g. 'UVTAB', 'NCHE' (TVET Act)

### GAP-T3: Missing tenant (institution) fields
`platform.tenants` needs:
- `license_number text`
- `license_date date`
- `license_status text` — e.g. 'active', 'expired', 'suspended'
- `ownership_type text` — e.g. 'public', 'private'

### GAP-T4: Missing staff fields
`app.staff_profiles` needs:
- `qualification_level text` — e.g. 'degree', 'diploma', 'certificate'
- `vocational_cert text` — vocational qualification name
- `pedagogy_trained boolean`
- `trainer_reg_number text`
- `license_number text`
- `license_expiry date`
- `industrial_experience_years int`

### GAP-T5: Missing CPD table
New table `app.staff_cpd`:
- CPD training name, date, duration, provider, certificate ref

---

## Fields Already Covered ✅
(No new migrations required for these)
- Student: `full_name`, `gender`, `date_of_birth`, `is_active`, `dropout_reason`, `dropout_date`, `phone`, `email`, `guardian_name/phone`, `year_of_study`, `class_section`
- Programme: `name`, `level`, `code`
- Staff: `first_name`, `last_name`, `email`, `phone`, `department`, `designation`, `employment_type`
- Marks: `app.mark_entries` covers assessment results
- Attendance: `app.attendance` covers learner attendance
- WBL: `app.it_reports` covers industrial training (needs review)

---

## Migration-Non-Blocking Gaps
(Can use `app.students.extension` JSONB for now, proper tables later)
- Vulnerability category → `extension ->> 'vulnerability'`
- Employer registry → future module
- Equipment inventory → future module
- Financial statements → document upload, future

---

## Applicability to Each VTI

| VTI | UVTAB Code | Key Migration Files Expected |
|---|---|---|
| Kasese TI (KTI) | UVT212 | ✅ Data analysed — see KTI-DATA-ANALYSIS.md |
| Milennium | DS-001/002 | ⬜ Students register + marks |
| Simon Peter | DS-003/004 | ⬜ Students register + marks |
| Kyema/UTC | DS-005/006/007 | ⬜ Students + admissions + marks |
| Virika | DS-012/014 | ⬜ Students + finance |

All 5 VTIs share the same schema. The migration toolkit is built once; institution-specific scripts call the shared library with a `--tenant` flag.
