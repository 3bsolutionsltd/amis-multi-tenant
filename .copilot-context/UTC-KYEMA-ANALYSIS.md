# UTC Kyema — Institution Analysis & Data Mapping

## Status: REFERENCE ONLY — do not implement until Phase 3 begins

---

## 1. Institution Profile (confirmed)

| Item | Value |
|---|---|
| Full name | Uganda Technical College — Kyema |
| Short name | UTC Kyema |
| Address | 5 KM Masindi–Kiryandongo Rd, P.O. Box 473 Masindi, Uganda |
| Phone | +256 465 423 396 |
| Website | www.utckyema.ac.ug |
| Email | ugatechkyema@yahoo.com |
| Current intake | 2026/2027 |
| Reporting date | 3rd February 2026 |
| Sponsorship types | Government / Private |

---

## 2. Programmes (confirmed)

| Code | Full Name | Duration |
|---|---|---|
| NCBC | National Certificate in Building Construction | 2 years |
| NCES | National Certificate in Electrical Systems and Management | 2 years |
| NCAM | National Certificate in Automotive Mechanics | 2 years |
| NCP | National Certificate in Plumbing | 2 years |
| NCWF | National Certificate in Welding and Fabrication | 2 years |

---

## 3. AMIS Roles Required

| Role | Maps to AMIS role | Responsibilities |
|---|---|---|
| Academic Registrar | `registrar` | Student records, enrolment, transitions |
| Accounts Office | `finance` | Fee payment recording + verification |
| Head of Department | `hod` | Marks review, PPE/training check |
| Dean of Students | `dean` | Guild fees verification, enrolment endorsement |
| Principal | `principal` | View-only access |
| ICT Technician | `admin` | Online registration guidance |
| Instructor | `instructor` | Marks entry |
| Centre Supervisor | `admin` | Final sign-off on admissions |

> **Note:** `dean` is a NEW role not in Phase 2. Add in Phase 3 alongside JWT auth.
> Roles outside AMIS scope: Security Officer, Custodian, Catering Officer,
> College Nurse, Librarian, Store Keeper, Sports Department, Warden.

---

## 4. Student Lifecycle — 3 Phases

### Phase 1: Application (one-time, on first entry)

```
DRAFT
  ↓ registrar submits
SUBMITTED
  ↓ registrar verifies documents
UNDER_REVIEW
  ↓ sent to selection committee
COMMITTEE_REVIEW
  ↓                      ↓                ↓
APPROVED_GOVT     APPROVED_PRIVATE     REJECTED
  ↓                      ↓             (with reasons)
  └──────────────────────┘
             ↓
          ENROLLED
```

### Phase 2: Term Registration (every term — repeating)

Triggered at the beginning of each term. Ends with Clearance Certificate issued.

```
REGISTRATION_STARTED
  ↓ AR verifies documents (NEW students only)
DOCUMENTS_VERIFIED
  ↓ directed to Accounts
FEES_VERIFIED              (Accounts: college dues paid)
  ↓
GUILD_FEES_VERIFIED        (Dean of Students: guild fees payslip)
  ↓
DEAN_ENDORSED              (Dean of Students: enrolment endorsed)
  ↓
HALL_ALLOCATED             (Custodian: hall of residence assigned)
  ↓
CATERING_VERIFIED          (Catering Officer: meal card issued)
  ↓
MEDICAL_CHECKED            (College Nurse: health status checked)
  ↓
LIBRARY_CARD_ISSUED        (Librarian: access card issued)
  ↓
ONLINE_REGISTERED          (ICT Technician: guided on AMIS — NEW only)
  ↓
EXAM_ENROLLED              (AR: 80% tuition + UBTEB fees verified)
  ↓
CLEARANCE_ISSUED  ⭐       (All 8 departments signed off)
```

> **Clearance Certificate** is issued at the END of the registration
> process — it is proof the student completed all steps.
> It is NOT an end-of-year document.

### Phase 3: Academic / Marks (every term, per course)

```
DRAFT         (instructor creates submission)
  ↓
SUBMITTED     (instructor submits)
  ↓
HOD_REVIEW    (HOD reviews)
  ↓
APPROVED      (HOD approves)
  ↓
PUBLISHED     (registrar publishes — IMMUTABLE)
```

---

## 5. Clearance Certificate — Department Sign-offs

Issued at end of term registration. Each department records:
- Whether student is cleared
- Any deduction amount owed
- Date of clearance

| Department | AMIS Role | Checks |
|---|---|---|
| Store Keeper | `admin` | Equipment/tools returned |
| Library | `admin` | Books returned, fines paid |
| Sports Department | `admin` | Sports equipment returned |
| Warden/Custodian | `hod` | Hostel deductions |
| Head of Department/Section | `hod` | Training items, PPE |
| Dean of Students | `dean` | Guild fee balance |
| Accounts Section | `finance` | Outstanding fee balance |
| Academic Registrar | `registrar` | Final sign-off |

---

## 6. Fee Structure (configurable — amounts TBC from UTC Kyema)

```json
"fees": {
  "tuitionFee": 0,
  "ubtebFee": 0,
  "guildFee": 0,
  "minimumPaymentThreshold": 0.80
}
```

> **80% rule:** Private students must pay at least 80% of tuition + UBTEB
> fees before the Academic Registrar can enrol them for exams.
> Government students: different threshold (TBC).
> All amounts configurable per VTI via Admin Studio — no code changes.

---

## 7. Configuration Design (no code — Admin Studio only)

### Module toggles
```json
"modules": {
  "termRegistration": {
    "enabled": true,
    "clearanceDepartments": [
      { "key": "store",     "label": "Store Keeper",       "role": "admin" },
      { "key": "library",   "label": "Library",            "role": "admin" },
      { "key": "sports",    "label": "Sports Department",  "role": "admin" },
      { "key": "warden",    "label": "Warden/Custodian",   "role": "hod" },
      { "key": "hod",       "label": "Head of Department", "role": "hod" },
      { "key": "dean",      "label": "Dean of Students",   "role": "dean" },
      { "key": "accounts",  "label": "Accounts Section",   "role": "finance" },
      { "key": "registrar", "label": "Academic Registrar", "role": "registrar" }
    ]
  }
}
```

> Other VTIs can remove departments from the list — no code change needed.

---

## 8. Form Field Mapping — Application Form (8 pages)

### Core columns (app.admission_applications table)

| Field | Column | Required |
|---|---|---|
| Surname | `last_name` | Yes |
| Other Name | `first_name` | Yes |
| Gender | `gender` | Yes |
| Date of Birth | `dob` | Yes |
| 1st Choice Programme | `programme` | Yes |
| Intake year | `intake` | Yes |
| Email | `email` | No |
| Phone/Tel | `phone` | No |
| Sponsorship type | `sponsorship_type` | Yes |

### Extension jsonb fields (app.admission_applications.extension)

#### Section A — Personal
| Key | Label | Type |
|---|---|---|
| `marital_status` | Marital Status | text |
| `home_village` | Home Village | text |
| `home_parish` | Home Parish | text |
| `home_sub_county` | Home Sub County | text |
| `home_district` | Home District | text |
| `citizenship` | Citizenship | text |
| `religious_affiliation` | Religious Affiliation | text |
| `country_of_residence` | Country of Permanent Residence | text |
| `postal_address` | Postal Address | text |

#### Section A — Parent/Guardian
| Key | Label | Type |
|---|---|---|
| `guardian_last_name` | Guardian Surname | text |
| `guardian_first_name` | Guardian Other Name | text |
| `guardian_village` | Guardian Home Village | text |
| `guardian_parish` | Guardian Home Parish | text |
| `guardian_sub_county` | Guardian Home Sub County | text |
| `guardian_district` | Guardian Home District | text |
| `guardian_nationality` | Guardian Nationality | text |
| `guardian_country` | Guardian Country of Residence | text |
| `guardian_occupation` | Guardian Occupation | text |
| `guardian_address` | Guardian Address | text |
| `guardian_phone` | Guardian Tel | text |

#### Section B — Programme Choice
| Key | Label | Type |
|---|---|---|
| `programme_second_choice` | 2nd Choice Programme | select |
| `programme_third_choice` | 3rd Choice Programme | select |
| `institution_first_choice` | 1st Choice TVET Institution | text |
| `institution_second_choice` | 2nd Choice TVET Institution | text |
| `institution_third_choice` | 3rd Choice TVET Institution | text |
| `course_choice_reason` | Reason for Course Choice | textarea |

#### Section C — UCE Results
| Key | Label | Type |
|---|---|---|
| `uce_index_no` | UCE Index Number | text |
| `uce_year` | Year of Examination | text |
| `uce_centre` | Name of Exam Centre | text |
| `uce_english` | English Grade | text |
| `uce_mathematics` | Mathematics Grade | text |
| `uce_physics` | Physics Grade | text |
| `uce_chemistry` | Chemistry Grade | text |
| `uce_biology_agriculture` | Biology/Agriculture Grade | text |
| `uce_technical_drawing` | Technical Drawing/Fine Art Grade | text |
| `uce_distinctions` | UCE Distinctions | number |
| `uce_credits` | UCE Credits | number |
| `uce_passes` | UCE Passes | number |

#### Section C — PLE Results
| Key | Label | Type |
|---|---|---|
| `ple_school` | PLE School | text |
| `ple_year` | PLE Year of Sitting | text |
| `ple_index_no` | PLE Index Number | text |
| `ple_aggregates` | PLE Total Aggregates | number |
| `ple_division` | PLE Division | text |
| `ple_maths` | PLE Maths Grade | text |
| `ple_english` | PLE English Grade | text |
| `ple_sst` | PLE SST Grade | text |
| `ple_science` | PLE Science Grade | text |
| `ple_distinctions` | PLE Distinctions | number |
| `ple_credits` | PLE Credits | number |
| `ple_passes` | PLE Passes | number |

#### Section C — UJTC/UCPC Results
| Key | Label | Type |
|---|---|---|
| `ujtc_institution` | UJTC/UCPC Institution | text |
| `ujtc_year` | Year of Sitting | text |
| `ujtc_index_no` | Index Number | text |
| `ujtc_course` | Course Name | text |
| `ujtc_grades` | Course Grades | json |
| `ujtc_distinctions` | Distinctions | number |
| `ujtc_credits` | Credits | number |
| `ujtc_passes` | Passes | number |

#### Section C — TVI National/Advanced Craft Certificate
| Key | Label | Type |
|---|---|---|
| `tvi_institution` | TVI Institution | text |
| `tvi_year` | Year of Sitting | text |
| `tvi_index_no` | Index Number | text |
| `tvi_course` | Course Name | text |
| `tvi_final_grade` | Final Grade | text |
| `tvi_grades` | Course Grades | json |
| `tvi_distinctions` | Distinctions | number |
| `tvi_credits` | Credits | number |
| `tvi_passes` | Passes | number |

#### Section C — A-Level (UACE) Results
| Key | Label | Type |
|---|---|---|
| `uace_school` | School Name | text |
| `uace_year` | Year of Sitting | text |
| `uace_index_no` | Index Number | text |
| `uace_combination` | Combination | text |
| `uace_total_points` | Total Points | number |
| `uace_grades` | Subject Grades | json |
| `uace_summary` | Grade Summary (As/Bs/Cs/Ds/Es/Os) | json |

#### Section C — Other Qualifications
| Key | Label | Type |
|---|---|---|
| `other_quals` | Other Qualifications | json (array of {institution, year, reg_no, course, grade}) |

#### Section D — Work Record
| Key | Label | Type |
|---|---|---|
| `work_record` | Work Record | json (array of {employer, post_held, period}) |

#### Section C — Referees & Sponsorship
| Key | Label | Type |
|---|---|---|
| `referee_1` | Referee 1 | json ({name, address, tel}) |
| `referee_2` | Referee 2 | json ({name, address, tel}) |
| `referee_3` | Referee 3 | json ({name, address, tel}) |
| `sponsor_name` | Sponsor Name | text |
| `sponsor_address` | Sponsor Address | text |
| `sponsor_contact` | Sponsor Tel/Email | text |

#### Section H — Committee Decision (registrar/admin/principal only)
| Key | Label | Type |
|---|---|---|
| `recommended_course` | Recommended Course | text |
| `recommended_institution` | Recommended Institution | text |
| `rejection_reason` | Reason Not Admitted | textarea |
| `committee_remarks` | Other Remarks | textarea |
| `selection_head_signed` | Head of Selection Team Signed | boolean |
| `supervisor_signed` | Centre Supervisor Signed | boolean |
| `decision_date` | Decision Date | date |

---

## 9. Form Field Mapping — Student/Trainee Biodata (2 pages)

This form is filled at registration and becomes the app.students record.

### Core columns (app.students table)

| Field | Column | Required |
|---|---|---|
| Surname | `last_name` | Yes |
| Other Name | `first_name` | Yes |
| Gender | `gender` | Yes |
| Date of Birth | `date_of_birth` | Yes |
| Phone contact | `phone` | No |
| Email address | `email` | No |
| Admission No | `admission_number` | Yes (generated) |
| Course | `programme` | Yes |
| Sponsorship type | `sponsorship_type` | Yes |

### Extension jsonb fields (app.students.extension)

#### Section 1 — Student Information
| Key | Label | Type |
|---|---|---|
| `admission_year` | Year of Admission | text |
| `photo_url` | Passport Photo | text (file URL — Phase 3+) |
| `age` | Age | number (derived from DOB) |
| `home_district` | Home District | text |
| `home_sub_county` | Home Sub County | text |
| `home_parish` | Home Parish | text |
| `home_village` | Home Village | text |
| `nationality` | Nationality | text |
| `nin` | National ID Number (NIN) | text |
| `present_address` | Present Address | text |
| `disability` | Disability/Health Challenges | text |

#### Section 2 — Parent/Guardian/Caretaker
| Key | Label | Type |
|---|---|---|
| `guardian_relationship` | Relationship to Student | select (Father/Mother/Sister/Brother/Aunt/Uncle/Grandfather/Grandmother/Neighbor/Friend/Self) |
| `guardian_name` | Guardian Full Name | text |
| `guardian_address` | Guardian Home Address | text |
| `guardian_phone` | Guardian Telephone | text |
| `guardian_nin` | Guardian NIN | text |
| `guardian_occupation` | Guardian Occupation | text |
| `guardian_socioeconomic` | Guardian Socio-economic Background | text |
| `guardian_sickness` | Guardian Chronic Sickness (if any) | text |

#### Section 3 — Last School Attended
| Key | Label | Type |
|---|---|---|
| `last_school_name` | Last School Name | text |
| `last_school_address` | Last School Address | text |
| `last_school_level` | Level of Education Attained | text |
| `last_school_year` | Year of Completion | text |

#### Registrar sign-off
| Key | Label | Type |
|---|---|---|
| `registrar_remarks` | Remarks/Comments by Academic Registrar | textarea |

---

## 10. Enrolment Checklist (configurable — stored in extension jsonb on enrolment record)

| Key | Label | Set by | Type |
|---|---|---|---|
| `hall_of_residence` | Hall of Residence Allocated | Custodian | text |
| `meal_card_issued` | Meal Card Issued | Catering Officer | boolean + date |
| `library_card_issued` | Library Access Card Issued | Librarian | boolean + date |
| `medical_cleared` | Medical/Health Status Checked | College Nurse | boolean + date |
| `guild_fees_paid` | Guild Fees Verified | Dean of Students | boolean |
| `online_registered` | Online Registration Guided | ICT Technician | boolean + date |
| `exam_enrolled` | Enrolled for Exams | Academic Registrar | boolean + date |

---

## 11. Outstanding Information Needed from UTC Kyema

| Item | Priority | Used for |
|---|---|---|
| Grading scale (marks thresholds) | 🔴 High | Marks module config |
| Fee amounts (tuition/UBTEB/guild per programme/year) | 🔴 High | Fees config |
| Student register (Excel/CSV) | 🔴 High | Data migration (Prompt 25) |
| Marks sheets (any term) | 🔴 High | Migration format (Prompt 26) |
| Payment records | 🟡 Medium | Fees migration (Prompt 26) |
| Staff list with roles + Dean of Students identified | 🟡 Medium | User seeding (Prompt 16) |
| Institution logo (PNG/SVG) | 🟠 Low | Branding config |
| Government student fee threshold | 🟠 Low | Fees config |

---

## 12. What Needs Code vs What Is Config-only

### Needs code (Phase 3 prompts)
| Item | Prompt |
|---|---|
| `dean` role added to role list | Prompt 16 (users table) |
| `admission_number` column on students | Migration in Prompt 25 |
| `sponsorship_type` column on students | Migration in Prompt 25 |
| `programme` column on students | Migration in Prompt 25 |
| Term registration workflow + clearance | Prompt (TBD — post marks/fees) |

### Config only (Admin Studio — no code)
| Item | Where |
|---|---|
| Admissions workflow states + transitions | payload.workflows.admissions |
| Term registration workflow | payload.workflows.termRegistration |
| Clearance departments list | payload.modules.termRegistration |
| Fee amounts + 80% threshold | payload.fees |
| All form fields + labels + sections | payload.forms.admissions + payload.forms.students |
| Navigation per role | payload.navigation |
| Branding (name, colours, logo) | payload.branding |

---

## 13. Documents Analysed (complete)

| Document | Pages | Status |
|---|---|---|
| Application Form | 8 pages | ✅ Fully mapped |
| Student/Trainee Biodata | 2 pages | ✅ Fully mapped |
| Enrolment Process Flowchart | 2 pages | ✅ Fully mapped |
| Clearance Certificate | 1 page | ✅ Fully mapped |

**Clearance certificate clarification (confirmed):**
Issued at the END of the term REGISTRATION process — not end of academic year.
It proves the student completed all 8 department sign-offs during registration.
Deductions per department are recorded before each sign-off.