# AMIS User Testing Guide

**Date:** April 2026  
**App:** Academic Management Information System (AMIS) — Multi-Tenant  
**URL:** http://localhost:5173 (web) | http://localhost:3000 (api)

> **All pages use real API calls** — there is no mock/hardcoded data. The backend must be running for any page to work.

---

## 1. Prerequisites

Before testing, ensure all services are running:

```powershell
docker compose up -d     # start Postgres
dbmate up                # run migrations
pnpm dev                 # starts both API (:3000) and Web (:5173)
```

Or individually:
```powershell
pnpm --filter api dev    # API on :3000
pnpm --filter web dev    # Web on :5173
```

Seed the database (creates tenants, students, staff, programmes, users, and published configs):
```powershell
$env:DATABASE_URL="postgres://postgres:password123@localhost:5432/amis_multi_tenant?sslmode=disable"
apps\api\node_modules\.bin\tsx.cmd db/seeds/seed.ts
```

---

## 2. Seeded Test Data Reference

### Tenants
| Tenant | Slug | Theme | Default Fee Due |
|---|---|---|---|
| Greenfield VTI | `greenfield-vti` | Blue (#2563EB) | BWP 15,000 |
| Riverside Tech College | `riverside-tech` | Purple (#7C3AED) | BWP 12,000 |

### Dev Login Credentials
**Password for all accounts:** `Password123!`

| Tenant | Email | Role |
|---|---|---|
| Greenfield VTI | `admin@tenant-a.test` | admin |
| Greenfield VTI | `registrar@tenant-a.test` | registrar |
| Greenfield VTI | `hod@tenant-a.test` | hod |
| Greenfield VTI | `instructor@tenant-a.test` | instructor |
| Greenfield VTI | `finance@tenant-a.test` | finance |
| Greenfield VTI | `principal@tenant-a.test` | principal |
| Greenfield VTI | `dean@tenant-a.test` | dean |
| Riverside Tech | `admin@tenant-b.test` | admin |
| Riverside Tech | `registrar@tenant-b.test` | registrar |
| Riverside Tech | `hod@tenant-b.test` | hod |
| Riverside Tech | `instructor@tenant-b.test` | instructor |
| Riverside Tech | `finance@tenant-b.test` | finance |
| Riverside Tech | `principal@tenant-b.test` | principal |
| Riverside Tech | `dean@tenant-b.test` | dean |

### Students (Greenfield VTI)
| Name | DOB |
|---|---|
| Alice Mokoena | 2004-03-12 |
| Brian Dlamini | 2003-07-22 |
| Carol Nkosi | 2005-01-08 |

### Students (Riverside Tech College)
| Name | DOB |
|---|---|
| David Osei | 2004-11-05 |
| Eva Mensah | 2003-09-14 |

### Staff (Greenfield VTI)
| # | Name | Dept | Type |
|---|---|---|---|
| STF001 | Jane Ndlovu | ICT | Full-time |
| STF002 | Peter Sithole | Engineering | Full-time |
| STF003 | Sarah Mahlangu | Hospitality | Part-time |
| STF004 | Moses Khumalo | ICT | Contract |

### Staff (Riverside Tech College)
| # | Name | Dept | Type |
|---|---|---|---|
| STF001 | Michael Asante | ICT | Full-time |
| STF002 | Grace Mensah | Engineering | Full-time |
| STF003 | Eric Boateng | ICT | Temporary |

### Programmes (Greenfield VTI) — 7 total
| Code | Title | Department | Duration |
|---|---|---|---|
| NCBC | National Certificate in Business Computing | Business & ICT | 12 mo |
| NCES | National Certificate in Electrical Systems | Engineering | 24 mo |
| NCAM | National Certificate in Automotive Mechanics | Engineering | 24 mo |
| NCP | National Certificate in Plumbing | Built Environment | 24 mo |
| NCWF | National Certificate in Welding & Fabrication | Engineering | 18 mo |
| NCCA | National Certificate in Civil & Construction | Built Environment | 24 mo |
| NCHM | National Certificate in Hospitality Mgmt | Hospitality | 12 mo |

### Programmes (Riverside Tech College) — 5 total
| Code | Title | Department | Duration |
|---|---|---|---|
| ND-IT | National Diploma in Information Technology | ICT | 36 mo |
| ND-EE | National Diploma in Electrical Engineering | Engineering | 36 mo |
| ND-MM | National Diploma in Mechanical Manufacturing | Engineering | 36 mo |
| CERT-CS | Certificate in Computer Science | ICT | 12 mo |
| CERT-NET | Certificate in Networking & Cybersecurity | ICT | 12 mo |

---

## 3. Login & Auth

**URL:** `/login`

### 3.1 Login Flow
1. Navigate to http://localhost:5173
2. You should be redirected to `/login`
3. The login form has 3 fields:
   - **Tenant** — dropdown (populated from `GET /auth/tenants`)
   - **Email** — text input
   - **Password** — password input
4. Enter credentials from the table above (e.g., `admin@tenant-a.test` / `Password123!`)
5. Click **Sign In** — should redirect to `/` (Dashboard)

### 3.2 Auth Behaviour
- JWT tokens stored in `localStorage` (`amis_access_token`, `amis_refresh_token`, `amis_user`)
- 401 responses trigger automatic token refresh via `POST /auth/refresh`
- Sign out button in header clears tokens and redirects to `/login`
- If session expired, navigation to any protected route redirects to `/login?redirect=...`

### 3.3 Error Cases
- Wrong password → "Invalid email, password, or tenant ID."
- Wrong tenant → same error message (no information leakage)

---

## 4. Dev Tools (Header Controls)

The top navigation bar (sticky header) shows:
- **App name** (from tenant config branding)
- **Tenant Switcher** — dropdown (all tenants)
- **Role Switcher** — dropdown (dev-only, bypasses real auth)
- **User email & role** display
- **Sign Out** button

### Tenant Switcher
- Switching reloads the app entirely (`window.location.href = "/"`)
- Clears all TanStack Query cache
- **Test:** Switch from Greenfield VTI → Riverside Tech College — app name changes, sidebar nav may differ, all data changes

### Role Switcher (Dev Mode Only)
- Roles: `admin`, `registrar`, `hod`, `instructor`, `finance`, `principal`
- Stored in `localStorage` as `amis_dev_role`
- Switching reloads the app entirely
- **Test matrix (from seeded config):**

| Role | Expected Nav Items |
|---|---|
| admin | Dashboard, Students, Admissions, Programmes, Term Registrations, Marks, Finance, Industrial Training, Field Placements, Analytics, Staff, Reports, Users |
| registrar | Dashboard, Students, Admissions, Programmes, Term Registrations, Marks, Industrial Training, Field Placements, Analytics, Reports |
| instructor | Dashboard, Students, Marks, Reports |
| finance | Dashboard, Finance |
| hod | Dashboard, Students, Programmes, Marks, Industrial Training, Field Placements, Analytics, Reports |
| principal | Dashboard, Students, Admissions, Programmes, Term Registrations, Marks, Finance, Industrial Training, Field Placements, Analytics, Reports |

> **Note:** Both tenants share the same nav config in the seed. The sidebar also always shows an **Admin Studio** link at the bottom.

---

## 5. Dashboard

**URL:** `/` (root)

The dashboard fetches real data from 4 API endpoints: `GET /students`, `GET /admissions/applications`, `GET /term-registrations`, `GET /marks/submissions`.

### Test Steps
1. Log in as admin to Greenfield VTI
2. Verify the **Welcome Banner** shows greeting + user email + role badge
3. Verify **4 KPI tiles**: Active Students, Applications, Term Registrations, Mark Submissions
4. Verify **Recent Students** list (up to 5 most recent, with names and dates)
5. Verify **Recent Applications** list (with workflow state badges)
6. Verify **6 Quick Action buttons**: New Student, New Application, Register Term, Record Payment, New Mark Sheet, Add User — each links to the correct page
7. Verify **Workflow Pipelines** section:
   - Mark submission states (DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED) with counts
   - Admission states (SUBMITTED → SHORTLISTED → INTERVIEW → ACCEPTED/ENROLLED/REJECTED) with counts
8. **Test:** If no data exists, tiles show "0" and lists show empty state

---

## 6. Students

**URLs:** `/students`, `/students/new`, `/students/:id`

### 6.1 List Page
1. Navigate to `/students`
2. Verify seeded students appear: Alice Mokoena, Brian Dlamini, Carol Nkosi (for Greenfield)
3. Each row shows: Name, DOB, Status badge (Active/Inactive), Enrolled date
4. **Search:** Type "Alice" — only Alice Mokoena should appear
5. **Filter:** Toggle "Show Inactive" to include deactivated students
6. **Pagination:** 20 students per page; test Next/Prev if more than 20

### 6.2 Create Student
1. Navigate to `/students/new`
2. Form fields are **config-driven** (from tenant config). Default fallback fields:
   - First Name (text, required)
   - Last Name (text, required)
   - Date of Birth (date, required)
3. Additional fields:
   - Programme dropdown (populated from `GET /programmes` API)
   - Extension fields (if configured in tenant config)
   - Guardian fields (if configured)
4. Submit → redirects to the new student's detail page
5. Navigate back to list — new student appears

### 6.3 Student Detail
1. Click a student from the list
2. **Profile section:** All fields displayed, inline editing (click field → edit → save)
3. **Fee Summary cards:** Total Due, Total Paid, Balance, Status (if fee data exists)
4. **Fee Clearance:** Percentage bar
5. **Term Registrations:** Last 5 registrations with status
6. **Actions:**
   - "Record Payment" link → navigates to `/finance/entry`
   - "Register" link → navigates to `/term-registrations/new?student_id=...&student_name=...`
   - **Deactivate** button → opens modal with reason, effective date, notes
   - **Reactivate** button (if inactive)

### 6.4 Multi-Tenant Isolation
1. Switch to Riverside Tech College
2. Go to `/students` — only David Osei and Eva Mensah should appear (NOT Greenfield students)

---

## 7. Admissions

**URLs:** `/admissions`, `/admissions/new`, `/admissions/import`, `/admissions/:id`

### 7.1 List Page
1. Navigate to `/admissions`
2. **Columns:** Name, Programme, Intake, Sponsorship, State (badge), Applied date
3. **Filters:**
   - Intake (text)
   - Programme (dropdown — currently hardcoded: NCBC, NCES, NCAM, NCP, NCWF)
   - State (dropdown — 8 options: submitted, under_review, shortlisted, interview, accepted, enrolled, rejected, withdrawn)
4. **Pagination:** Verify Next/Prev buttons

### 7.2 New Application
1. Navigate to `/admissions/new`
2. **Two-column form:**
   - Left: first_name, last_name, email, phone, date of birth
   - Right: gender (select), programme (dropdown from `GET /programmes`), intake (default "2026/2027"), sponsorship_type
3. Submit → should appear in list with state `submitted`

### 7.3 Workflow Transitions
Workflow: `submitted → shortlisted → interview → accepted / rejected`

1. Open an application in `submitted` state
2. The detail page shows all application fields + any extension data (collapsible section)
3. **Dynamic action buttons** appear based on current state and configured transitions
4. Click "Shortlist" → state changes to `shortlisted`, badge updates
5. Click "Interview" → state changes to `interview`
6. Click "Accept" → state changes to `accepted`
7. **Enrol button** (on `accepted` applications) → creates a student record from the application data
8. Test "Reject" from `interview` → state changes to `rejected`
9. **Verify:** Only valid transition buttons appear for the current state

### 7.4 Import (CSV)
1. Navigate to `/admissions/import`
2. **3-step flow:**
   - **Step 1 — Upload:** Choose a CSV file. Required headers: `first_name`, `last_name`, `programme`, `intake`
   - **Step 2 — Preview:** Shows valid and invalid rows with validation errors
   - **Step 3 — Confirm:** Click confirm to import valid rows
3. After import, applications appear in the admissions list

### 7.5 Public Application Page (No Login Required)
1. Navigate to `/apply/greenfield-vti` — this is an **unauthenticated** route
2. **Form fields:** first_name, last_name, programme (text input, not dropdown), intake, email, phone
3. Submit → shows a success message with application reference ID
4. Log in as admin → navigate to `/admissions` → the new application should appear

---

## 8. Programmes

**URLs:** `/programmes`, `/programmes/:id`

### 8.1 List Page
1. Navigate to `/programmes`
2. **Columns:** Code, Title, Department, Duration, Level, Status (Active/Inactive)
3. **Filters:** Search (by code/title), Show Inactive toggle
4. **Inline Create:** Click "Add Programme" → opens modal with fields: code, title, department, duration_months, level, is_active
5. Verify 7 programmes for Greenfield VTI (see data table above)

### 8.2 Detail Page
1. Click a programme from the list
2. All fields displayed with inline editing capability
3. **Deactivate:** Confirm dialog → sets `is_active = false`
4. **Delete:** Confirm dialog → permanently removes programme

### 8.3 Multi-Tenant Isolation
- Switch to Riverside Tech College → only 5 programmes (ND-IT, ND-EE, etc.)

---

## 9. Term Registrations

**URLs:** `/term-registrations`, `/term-registrations/new`, `/term-registrations/bulk`, `/term-registrations/:id`

### 9.1 List Page
1. Navigate to `/term-registrations`
2. **Columns:** Student, Admission No, Programme, Year/Term, State (badge), Created
3. **Filters:**
   - Academic Year (text)
   - Term (text)
   - State (dropdown with 12 states):
     `REGISTRATION_STARTED`, `DOCUMENTS_VERIFIED`, `FEES_VERIFIED`, `GUILD_FEES_VERIFIED`, `DEAN_ENDORSED`, `HALL_ALLOCATED`, `CATERING_VERIFIED`, `MEDICAL_CHECKED`, `LIBRARY_CARD_ISSUED`, `ONLINE_REGISTERED`, `EXAM_ENROLLED`, `CLEARANCE_ISSUED`
4. **Pagination:** Verify Next/Prev

### 9.2 Single Registration
1. Navigate to `/term-registrations/new`
2. **Fields:**
   - Student (autocomplete search)
   - Academic Year (text)
   - Term (text)
3. Accepts URL prefill: `?student_id=...&student_name=...` (linked from Student Detail page)
4. Submit → appears in list with initial workflow state

### 9.3 Detail Page
1. Click a registration from the list
2. Shows student name (clickable link to student), all fields, current state
3. **Workflow action buttons** appear dynamically based on current state + configured transitions

### 9.4 Bulk Registration
1. Navigate to `/term-registrations/bulk`
2. **Two options:**
   - **Promote All Active Students:** Enter academic year + term → click Promote → registers all active students not yet in that term
   - **Register Specific Students:** Paste student IDs (one per line) + academic year + term → click Register
3. Shows result count (how many registered, errors if any)

---

## 10. Marks

**URLs:** `/marks`, `/marks/new`, `/marks/bulk-entry`, `/marks/:id`

### 10.1 List Page
1. Navigate to `/marks`
2. **Columns:** Course, Programme, Intake/Term, State (DRAFT/SUBMITTED/HOD_REVIEW/APPROVED/PUBLISHED), Created
3. **Filters:**
   - Programme (dropdown — currently hardcoded: NCBC, NCES, NCAM, NCP, NCWF)
   - Intake (text)
   - Term (select: Term 1, Term 2, Term 3)
4. **Pagination**

### 10.2 Create Submission
1. Navigate to `/marks/new`
2. **Fields:**
   - Course ID (text input)
   - Programme (select — hardcoded list)
   - Intake (text)
   - Term (text)
3. Submit → status starts at `DRAFT`

### 10.3 Mark Detail + Workflow
1. Click a submission from the list
2. **Metadata:** Course, Programme, Intake, Term, State badge, Dates
3. **Mark Entries Table:**
   - Add entry: Student (autocomplete search) + Score (0-100) input
   - Inline score editing for existing entries
   - **Not editable when state = PUBLISHED** (entries are read-only)
4. **Workflow actions:** Dynamic buttons based on current state:
   - DRAFT → "Submit"
   - SUBMITTED → "Review" (HOD/admin)
   - HOD_REVIEW → "Approve" or "Return" (back to DRAFT)
   - APPROVED → "Publish"
5. **Audit Trail:** Expandable panel showing all state transitions with timestamp + user

### 10.4 Bulk Mark Entry
1. Navigate to `/marks/bulk-entry`
2. **Filters:**
   - Term (text)
   - Course ID (text)
   - Assessment Type (dropdown: End of Term, Midterm, Coursework, Practical)
3. After filtering, select a mark submission
4. A grid appears showing all students (up to 100) with a score input per row
5. Enter scores → click **Save All**
6. **Clear** button resets all inputs
7. Navigate away and back → scores are persisted

### 10.5 Full Workflow Test
1. Create a new submission (`/marks/new`) → state: DRAFT
2. Add entries via detail page or bulk entry
3. Click "Submit" → state: SUBMITTED
4. Switch role to `hod`
5. Open the same submission → Click "Review" → state: HOD_REVIEW
6. Click "Approve" → state: APPROVED (or "Return" → back to DRAFT)
7. Click "Publish" → state: PUBLISHED
8. **Verify:** Try editing an entry on a PUBLISHED submission — should be blocked (read-only, 409 from API)

---

## 11. Finance

**URLs:** `/finance`, `/finance/entry`, `/finance/import`, `/finance/overview`, `/finance/receipt`, `/finance/reconciliation`

### 11.1 Fees Page (Student Lookup)
1. Navigate to `/finance`
2. **Student search:** Autocomplete input to find a student
3. After selecting a student:
   - **Fee Summary cards:** Total Due, Total Paid, Balance, Status
   - **Payment History table:** All transactions for the student
4. **Action links:** Overview, Import, Record Payment, Print Receipt

### 11.2 Fee Entry
1. Navigate to `/finance/entry`
2. **Fields:**
   - Student (autocomplete search)
   - Amount (number)
   - Reference (text)
   - Paid At (date)
3. Submit → payment recorded, appears in student's transaction history
4. **Known issue:** Page may reference undefined `setSuccess` (cosmetic bug)

### 11.3 Fee Overview
1. Navigate to `/finance/overview`
2. **Two tabs** at the top: **Overview** and **Defaulters** (active tab highlights blue)
3. **Overview tab** — 6 stat cards:
   - Total Students
   - Total Expected (BWP)
   - Total Collected (BWP)
   - Collection Rate (%)
   - Fully Paid
   - Defaulters
4. **Defaulters tab:**
   - Table columns: Admission #, Student, Programme, Paid, Balance, Status ("OWING" badge)
   - Click a row → navigates to `/students/:id`

### 11.4 Fee Receipt (Printable)
1. Navigate to `/finance/receipt?studentId=<uuid>`
2. Shows printable receipt:
   - Student info (name, admission #)
   - Transaction table (date, reference, amount)
   - Total paid
3. **Print button** → triggers browser print dialog
4. @media print CSS hides non-essential elements

### 11.5 Fee Import (CSV)
1. Navigate to `/finance/import`
2. **3-step flow** (same pattern as admissions import):
   - Upload CSV with headers: `studentId` (UUID), `amount`, `reference`, `paid_at`
   - Preview valid/invalid rows
   - Confirm import
3. Currency displayed as **ZAR** on this page

### 11.6 SchoolPay Reconciliation
1. Navigate to `/finance/reconciliation`
2. **Filter:** Status (unmatched, matched, disputed)
3. Lists pending reconciliation items from SchoolPay
4. **Match flow:** Enter Student ID inline → click Match → links the payment to a student

---

## 12. Results

**URLs:** `/results`, `/results/slip`

### 12.1 Results Page
1. Navigate to `/results`
2. **Term selector:** Dropdown populated from `GET /terms` API (auto-selects current term)
3. **Stats bar:** Students Ranked, Avg GPA, Highest GPA
4. **Process Results:** Click ⚙ button → triggers `POST /results/terms/:id/process` (computes GPAs)
5. **Rankings table:** Rank, Admission #, Student Name, GPA, Credits, Slip link
6. Students ordered by GPA descending

### 12.2 Results Slip (Printable)
1. Navigate to `/results/slip?student_id=<uuid>&term_id=<uuid>`
2. Fetches student, term, and results data from 3 API endpoints
3. **Printable slip layout:**
   - App name header
   - Student info grid (name, admission #, programme)
   - Courses table: Course, Score, Grade, Grade Point
   - Summary: GPA, Total Credits, Class Rank
4. **Print / Save PDF** button → triggers browser print dialog
5. @media print CSS applied

---

## 13. Clearance

**URL:** `/clearance`

### Test Steps
1. Navigate to `/clearance`
2. **Two text inputs:** Student ID (UUID) and Term ID (UUID)
   > Note: These are raw UUID inputs, not autocomplete search fields
3. Enter a valid student ID and term ID
4. Click **Init Clearance** → creates 8 PENDING department sign-offs via `POST /clearance/init`
5. Verify **8 department rows** appear:

| Key | Label |
|---|---|
| store | Store |
| library | Library |
| sports | Sports |
| warden | Warden |
| hod | Head of Department |
| dean_of_students | Dean of Students |
| accounts | Accounts (Finance) |
| academic_registrar | Academic Registrar |

6. For each department:
   - Click ✅ (Sign) → status changes to `SIGNED`
   - Click ❌ (Reject) → prompts for remarks → status changes to `REJECTED`
7. **Status badges:** SIGNED (green), REJECTED (red), PENDING (gray)
8. **Progress counter:** "Departments (X/8)" shows how many are signed
9. When all 8 are SIGNED → "Fully Cleared" badge appears

---

## 14. Staff

**URLs:** `/staff`, `/staff/new`, `/staff/:id`

> **Note:** `/staffs` (with trailing 's') automatically redirects to `/staff`

### 14.1 List Page
1. Navigate to `/staff`
2. **Columns:** Name, Staff No, Department, Designation, Type, Status
3. **Filters:** Search (name), Department (dropdown)
4. **Inline Create:** Modal for quick staff creation
5. **Inline Delete:** Deactivate button per row
6. Verify Greenfield VTI staff: Jane Ndlovu, Peter Sithole, Sarah Mahlangu, Moses Khumalo

### 14.2 Create Staff (Full Form)
1. Navigate to `/staff/new`
2. **Personal section:** first_name, last_name, email, phone
3. **Employment section:** staff_number, employment_type (select), department, designation, join_date, salary
4. **Notes:** textarea
5. Submit → staff appears in list

### 14.3 Staff Detail
1. Click a staff member from the list
2. **Profile:** All fields displayed with inline editing capability
3. **Contracts tab:** Table of contracts + add form
4. **Attendance tab:** Table of records + record form (session: full/am/pm, status: present/absent/late/excused)
5. **Appraisals tab:** Table of appraisals + add form (period, rating, comments)
6. **Currency:** Salary displayed in ZAR

### 14.4 Multi-Tenant Isolation
- Switch to Riverside Tech College → different staff list (Michael Asante, Grace Mensah, Eric Boateng)

---

## 15. Industrial Training

**URLs:** `/industrial-training`, `/industrial-training/new`, `/industrial-training/:id`

### 15.1 List Page
1. Navigate to `/industrial-training`
2. **Columns:** Student, Company, Department, Dates, Status (scheduled/active/completed/cancelled)
3. **Filter:** Status dropdown
4. **Pagination**

### 15.2 Create Placement
1. Navigate to `/industrial-training/new`
2. **Fields:** student_id (UUID text input — no autocomplete), company, department, supervisor, start_date, end_date, status, notes
3. Submit → appears in list

### 15.3 Detail / Edit
1. Click a placement from the list
2. Read-only view by default → click Edit toggle → all fields editable → Save

---

## 16. Field Placements

**URLs:** `/field-placements`, `/field-placements/new`, `/field-placements/:id`

### 16.1 List Page
1. Navigate to `/field-placements`
2. **Columns:** Student, Host Organisation, Type, Dates, Status
3. **Filters:** Placement Type (field/clinical/community/industry), Status
4. **Pagination**

### 16.2 Create Placement
1. Navigate to `/field-placements/new`
2. **Fields:** student_id (UUID text input — no autocomplete), host_organisation, placement_type (select: field/clinical/community/industry), supervisor, start_date, end_date, status, notes
3. Submit → appears in list

### 16.3 Detail / Edit
1. Click a placement → read-only view → Edit toggle → editable fields → Save

---

## 17. Alumni

**URLs:** `/alumni`, `/alumni/:id`

> Alumni are created by graduating students (`POST /students/:id/graduate` from the Student Detail page), not from the Alumni UI.

### 17.1 List Page
1. Navigate to `/alumni`
2. **Columns:** Name, Programme, Admission #, Graduated date
3. **Filter:** Search (name)
4. **Export:** "Export CSV" button → downloads alumni data
5. **Pagination**

### 17.2 Detail Page
1. Click an alumni record
2. **Read-only display:** Programme, Admission #, Graduation Date, Graduation Notes, Created

---

## 18. Analytics

**URL:** `/analytics`

### Test Steps
1. Navigate to `/analytics`
2. **Filters:** Academic Year (text), Term (text)
3. **4 KPI tiles:** Active Students, Term Registrations, Admission Applications, Mark Submissions
4. **Breakdown tables:**
   - Admissions by State
   - Marks by State
   - Industrial Training by Status
   - Field Placements by Status
5. **Students by Programme:** Top 10 table
6. **Financial Summary:** Total Collected (UGX), Students with Payments

---

## 19. Reports

### 19.1 IT Reports — `/reports/it`
1. Navigate to `/reports/it`
2. **Table:** Period, Type (Student/Supervisor badge), Submitted By, Rating (/5), Date
3. **Filters:** Search (period/submitter), Report Type dropdown
4. **Create:** Click "Add Report" → modal with: IT record ID, report_type, period, summary, challenges, recommendations, rating (1-5), submitted_by
5. Submit → report appears in table

### 19.2 Teacher Evaluations — `/reports/evaluations`
1. Navigate to `/reports/evaluations`
2. **Table:** Academic Period, Student ID, Staff ID, Comments, Submitted
3. **Filter:** Search (academic period)
4. **Create:** Click "Add Evaluation" → modal with: student_id (UUID), staff_id (UUID), academic_period, scores (raw JSON input), comments
5. Submit → evaluation appears in table

### 19.3 Instructor Reports — `/reports/instructor`
1. Navigate to `/reports/instructor`
2. **Table:** Period, Type (Weekly/Monthly badge), Status (Draft/Submitted badge), Due Date, Actions
3. **Filters:** Search (period/content), Report Type (Weekly/Monthly), Status (Draft/Submitted)
4. **Create:** Click "Add Report" → modal with: staff_id (UUID), report_type, period, content, due_date
5. **Submit action:** For Draft reports, click "Submit" button → transitions to Submitted status

---

## 20. Users

**URLs:** `/users`, `/users/new`

> Visible in nav for `admin` role only

### 20.1 Users List
1. Navigate to `/users`
2. **Columns:** Email, Role (badge), Status (Active/Inactive), Created, Actions
3. **Filter:** Role dropdown (7 roles: admin, registrar, hod, instructor, finance, principal, dean)
4. **Pagination:** 20 per page
5. **Actions per user:**
   - **Edit Role** → modal to change role
   - **Activate / Deactivate** toggle button

### 20.2 Create User
1. Navigate to `/users/new`
2. **Fields:** Email, Password, Role (select from 7 roles, default: registrar)
3. Submit → user appears in list

### 20.3 Role Access Test
1. Switch to `instructor` role
2. `/users` should not appear in the sidebar navigation
3. Navigating directly to `/users` — page loads but the user sees their own tenant's user list (no server-side role guard on the read endpoint)

---

## 21. Admin Studio

**URL:** `/admin-studio` (separate layout with dark sidebar)

> Accessible to admins. Has its own sub-navigation.

### 21.1 Config Dashboard — `/admin-studio`
1. Navigate to `/admin-studio`
2. **Quick links** to all sub-pages
3. **Branding summary:** App name + theme color swatch
4. **Modules summary:** Enabled/disabled indicator dots
5. **Published version info:** Version details, publish date
6. **Draft status:** Whether a draft exists
7. **Recent audit log:** Last 5 config actions

### 21.2 Tenant Manager — `/admin-studio/tenants`
1. Navigate to `/admin-studio/tenants`
2. **Table:** Name, Slug, Email, Active badge, Created, Edit button
3. **Create tenant:** Opens form with: slug (create only), name, contactEmail, address, phone, logoUrl, isActive
4. **Edit tenant:** Same form but slug is read-only, isActive toggle available
5. Verify both seeded tenants appear

### 21.3 Config Editor — `/admin-studio/editor`
1. Navigate to `/admin-studio/editor`
2. **Two view modes:**
   - **Structured:** Form fields for branding (appName, logoUrl), theme (primaryColor), modules (checkboxes), fees (defaultTotalDue)
   - **Raw JSON:** Full config payload as editable textarea
3. **Status bar:** Shows if draft/published versions exist
4. **Actions:**
   - **Save Draft** → creates/updates draft config
   - **Validate** → checks config structure (`POST /config/validate`)
   - **Publish** → confirmation dialog → publishes draft as active config
   - **Rollback** → confirmation dialog → reverts to previous published version

### 21.4 Branding Editor — `/admin-studio/branding`
1. Navigate to `/admin-studio/branding`
2. **Fields:**
   - App Name (text)
   - Logo URL (text + image preview)
   - Primary Color (color picker + hex input + preview swatch)
3. **Save as Draft** → note: must publish from Config Editor to make live
4. **Test:** Change appName → save → go to Config Editor → publish → header app name updates

### 21.5 Module Toggles — `/admin-studio/modules`
1. Navigate to `/admin-studio/modules`
2. **Toggle switches** for: Students, Admissions, Finance
   > Only these 3 modules are toggleable. Other modules (marks, staff, reports, etc.) are always enabled.
3. **Save as Draft** → publish from Config Editor to apply

### 21.6 Workflow Viewer — `/admin-studio/workflows`
1. Navigate to `/admin-studio/workflows`
2. **Read-only display** for each configured workflow:
   - **Admissions:** submitted → shortlisted → interview → accepted/rejected
   - **Marks:** DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED
3. For each workflow shows: Initial state badge, state chips, transitions table (Action, From, To)

### 21.7 Navigation Editor — `/admin-studio/navigation`
1. Navigate to `/admin-studio/navigation`
2. **Role selector:** 6 roles (admin, registrar, hod, instructor, finance, principal)
3. **Nav items table:** #, Label, Route, Actions (Move Up ↑, Move Down ↓, Delete ✕)
4. **Add row:** Label + Route text inputs
5. **Actions:**
   - **Save Draft** → saves nav changes as draft
   - **Save & Publish** → saves and publishes immediately
6. **Test:** Add a new nav item (e.g., Label: "Test", Route: "/test") → Save & Publish → check sidebar updates

---

## 22. Multi-Tenant Isolation Checklist (RLS)

| Check | Steps | Expected |
|---|---|---|
| Student isolation | View students as Greenfield (Alice, Brian, Carol), switch to Riverside | Only David Osei and Eva Mensah |
| Staff isolation | View staff as Greenfield (4 staff), switch to Riverside | Only 3 different staff |
| Programme isolation | View programmes as Greenfield (7), switch to Riverside | Only 5 different programmes |
| Marks isolation | Create a mark submission in Greenfield, switch to Riverside | Submission not visible |
| Config isolation | Edit branding in Greenfield, switch to Riverside | App name unchanged |
| Fee isolation | Record a payment for Greenfield student, switch to Riverside | Payment not visible |
| Term Reg isolation | Register a student in Greenfield, switch to Riverside | Registration not visible |

---

## 23. Error Recovery Testing

### 23.1 ErrorBoundary Reset
1. Navigate to a route that will trigger an error (e.g., `/students/invalid-uuid`)
2. ErrorBoundary catches the crash → shows "Something went wrong" with a "Go Home" link
3. Click "Go Home" → navigates to `/` without full page reload
4. Navigate to any other valid route → error boundary resets automatically (keyed on pathname)

### 23.2 Route Redirects
1. Navigate to `/staffs` → should automatically redirect to `/staff` (not 404)

### 23.3 Auth Redirect
1. Clear localStorage (`amis_access_token`)
2. Try to navigate to any page (e.g., `/students`)
3. Should redirect to `/login?redirect=/students`
4. After login, should redirect back to `/students`

---

## 24. Known Issues / Limitations

| Issue | Details |
|---|---|
| **Currency inconsistency** | Fee Overview/Receipt uses BWP, Analytics uses UGX, Staff Detail uses ZAR, Fee Import uses ZAR |
| **Hardcoded programme dropdowns** | Admissions list filter and Marks list filter use hardcoded programme codes (NCBC/NCES/NCAM/NCP/NCWF) instead of fetching from the API |
| **FeeEntryPage bug** | May reference undefined `setSuccess` — cosmetic issue |
| **No student autocomplete on some pages** | Industrial Training and Field Placements create pages require raw student UUID — no search |
| **Reports use raw UUIDs** | Teacher Evaluations modal requires raw student_id/staff_id UUIDs; scores field expects raw JSON |
| **Module toggles limited** | Only Students, Admissions, Finance can be toggled. Other modules are always on |
| **Password reset not in UI** | API has `PUT /users/:id/password` but no UI page exposes it |
| **Application status check not in UI** | API has `GET /public/:tenantSlug/applications/:id/status` but no public tracking page |

---

## 26. Procurement

**URLs:** `/procurement`, `/procurement/requisitions/new`, `/procurement/requisitions/:id`, `/procurement/orders/new`, `/procurement/orders/:id`, `/procurement/grns/new`, `/procurement/grns/:id`, `/procurement/suppliers`

**Who participates:**

| Role | What they do |
|------|-------------|
| `admin` / `registrar` | Create PRs, manage suppliers, view all records |
| `hod` | Recommend (approve at department level) a submitted PR |
| `principal` | Give final institutional approval on HOD-recommended PRs |
| `finance` | Convert approved PRs to LPOs; record GRNs |

All roles can view PRs. Only specific transitions are gated.

---

### 26.1 Purchase Requisition (PR) Workflow

The PR passes through these states in order:

```
draft → submitted → hod_recommended → principal_approved → ordered → closed
                                   ↘ rejected (at any stage)        ↘ closed
```

**State labels shown in the UI:**

| Status | Badge label | Colour |
|--------|-------------|--------|
| draft | Draft | Grey |
| submitted | Submitted | Blue |
| hod_recommended | HOD Recommended | Purple |
| principal_approved | Principal Approved | Green |
| ordered | Ordered | Teal |
| closed | Closed | Grey |
| rejected | Rejected | Red |

---

### 26.2 Creating a PR

**Log in as:** `admin@tenant-a.test` or `registrar@tenant-a.test`

1. Navigate to **Procurement → Requisitions** (🛒 in sidebar)
2. Click **+ New Requisition**
3. Fill in:
   - **PR Number** (e.g. `PR-2026/001`) — required, must be unique
   - **Title** (e.g. "Lab chemicals for Term 2")
   - **Department** (e.g. "Science")
   - **Requested By** (your name)
   - **Priority** — Low / Medium / High / Urgent
   - **Academic Year** (e.g. `2025/2026`)
   - **Required By** (date)
   - **Notes** (optional)
4. Click **Save PR** — created in `draft` state
5. Navigate back to the PR list — the new PR appears with a **Draft** badge

---

### 26.3 Submitting a PR for HOD Review

**Log in as:** any role (including the creator)

1. Open a PR in `draft` state
2. The action panel shows:
   - **Submit to HOD** button
   - **Reject** button
3. Click **Submit to HOD** → status changes to `submitted`
4. Badge on list page updates to **Submitted** (blue)

---

### 26.4 HOD Recommendation

**Log in as:** `hod@tenant-a.test`

1. Navigate to **Procurement → Requisitions**
2. Filter by status `submitted` (or scroll to find the PR)
3. Open the PR — action panel now shows:
   - **HOD Recommend** button
   - **Reject** button
4. Click **HOD Recommend** → status changes to `hod_recommended`
5. The detail page info grid now shows:
   - **Recommended By:** `hod@tenant-a.test`
   - **Recommended At:** current timestamp
6. Badge updates to **HOD Recommended** (purple)

> If you try to click "Submit to HOD" on a PR already in `submitted` state, the API returns 422 — invalid transition.

---

### 26.5 Principal Approval

**Log in as:** `principal@tenant-a.test`

1. Open a PR in `hod_recommended` state
2. Action panel shows:
   - **Principal Approve** button
   - **Reject** button
3. Click **Principal Approve** → status changes to `principal_approved`
4. Info grid now shows:
   - **Approved By:** `principal@tenant-a.test`
   - **Approved At:** current timestamp
5. Badge updates to **Principal Approved** (green)

---

### 26.6 Converting an Approved PR to an LPO

**Log in as:** `admin@tenant-a.test` or `finance@tenant-a.test`

1. Open a PR in `principal_approved` state
2. Click **Convert to LPO** → status changes to `ordered`
3. Navigate to **Procurement → Orders**
4. Click **+ New Local Purchase Order (LPO)**
5. Fill in:
   - **LPO Number** (e.g. `LPO-2026/001`) — note the UI now says "LPO", not "PO"
   - **Supplier**
   - **Order Date**
   - Link back to the PR if needed
6. Click **Save** — LPO created
7. The LPO Detail page title reads **LPO: LPO-2026/001** (not "PO:")

---

### 26.7 Rejection at Any Stage

Any authorised user can reject at any transition point:

1. Open a PR in any non-`closed` / non-`ordered` state
2. Click **Reject** — status changes to `rejected` (red badge)
3. From `rejected`, the only available action is **Close** → `closed`

---

### 26.8 Invalid Transition Guard

The API enforces a strict state machine. To test the guard:

1. Create a PR and note its ID
2. Using browser DevTools (Network tab → Fetch/XHR), manually send:
   ```
   PATCH /procurement/requisitions/:id/transition
   Body: { "status": "principal_approved" }
   ```
   (attempting to skip from `draft` straight to `principal_approved`)
3. Expected response: **422 Unprocessable Entity** — `"Invalid transition from draft to principal_approved"`

---

### 26.9 Goods Received Notes (GRN)

**Log in as:** `admin@tenant-a.test` or `finance@tenant-a.test`

1. Navigate to **Procurement → GRNs**
2. Click **+ New GRN**
3. Link to an LPO, record received quantities and condition
4. GRN list shows status badges and supplier names

---

### 26.10 Suppliers

1. Navigate to **Procurement → Suppliers**
2. Manage supplier records (name, contact, category)
3. Suppliers are referenced when creating LPOs and GRNs

---

## 27. Inventory & Stores

**URLs:** `/inventory`, `/inventory/items/new`, `/inventory/items/:id`, `/inventory/issuances/new`, `/inventory/stock-takes/new`, `/inventory/stock-takes/:id`

**Who participates:**

| Role | What they do |
|------|-------------|
| `admin` / `registrar` | Full access — create items, issuances, stock takes |
| `finance` | View inventory; create issuances |
| `hod` | View items and issuances for their department |
| `principal` | Read-only overview |

---

### 27.1 Inventory Page Tabs

Navigate to **Inventory** (📦 in sidebar). Five tabs:

| Tab | Content |
|-----|---------|
| **Items** | All stock items with current stock levels and reorder alerts |
| **Issuances** | Store issuances (items issued to departments/persons) |
| **Transactions** | All stock movements (receipts, issues, adjustments) |
| **Low Stock ⚠️** | Items at or below reorder level |
| **Stock Takes** | Annual stock verification records |

---

### 27.2 Creating an Inventory Item

**Log in as:** `admin@tenant-a.test`

1. Go to the **Items** tab → click **+ New Item**
2. Fill in:
   - Item Code (e.g. `CHEM-001`)
   - Name (e.g. "Hydrochloric Acid 1L")
   - Category (Laboratory)
   - Unit of Measure (bottles)
   - Reorder Level (e.g. `5`)
   - Unit Cost (optional)
3. Click **Save**
4. Item appears in list. If Current Stock ≤ Reorder Level, a ⚠️ icon shows and the item appears in the **Low Stock** tab

---

### 27.3 Creating a Store Issuance (with Department)

**Log in as:** `admin@tenant-a.test`

1. Go to the **Issuances** tab → click **+ New Issuance**
2. Fill in:
   - **Issuance Number** (required, e.g. `ISS-2026/001`)
   - **Issue Date**
   - **Issued To** (required — person receiving)
   - **Issued By** (store officer name)
   - **Department** ← **new field** — e.g. "Science Lab", "Library", "Admin"
   - **Purpose**
   - **Notes**
3. Under **Items to Issue**, click **+ Add Item**:
   - Select item from dropdown (shows item code + current stock)
   - Enter Qty Requested and Qty Issued
4. Click **Save Issuance**
5. Navigate to **Issuances** tab — new issuance shows the **Department** column

> The Department field makes it easy to track which department received what — a key requirement from the Inventory Management Officer interview.

---

### 27.4 Issuing a Draft Issuance

1. Find an issuance in **Draft** status in the Issuances tab
2. Click the **Issue** button on that row
3. Status changes to **Issued** (green badge)
4. Stock levels of the issued items decrease accordingly — check the **Transactions** tab to see the movement

---

### 27.5 Annual Stock Take — Create

**Log in as:** `admin@tenant-a.test`

1. Go to the **Stock Takes** tab → click **+ New Stock Take**
2. Fill in:
   - **Reference** (required, e.g. `ST-2025/2026`) — must be unique per tenant
   - **Financial Year** (e.g. `2025/2026`)
   - **Take Date** (defaults to today)
   - **Title** (e.g. "Annual Stock Verification 2025/2026")
   - **Conducted By** (officer name)
   - **Notes**
3. Under **Item Counts**, click **+ Add Item**:
   - Select an inventory item — **Expected Qty auto-fills** from current stock
   - Enter **Department** (e.g. "Science Lab")
   - Adjust **Expected Qty** if needed
   - Enter **Counted Qty** after physical count
   - Set **Condition**: Good / Fair / Damaged / Missing
4. Click **Save Stock Take** — created in `in_progress` status
5. Redirected to the Stock Take Detail page

---

### 27.6 Annual Stock Take — Detail & Variance Analysis

On the Stock Take Detail page:

1. **Summary header** shows: Reference, Financial Year, Take Date, Conducted By, Status badge
2. **Stats cards** show: Total Items, Counted, Discrepancies
3. **Items table** columns:
   - Item name and code
   - Department
   - Expected Qty
   - Counted Qty (shows "Not counted" in grey if missing)
   - **Variance** = Counted − Expected:
     - Positive variance → orange (surplus)
     - Negative variance → **red** (shortage ← important for audit)
     - Zero → green ✓
   - Condition, Notes

**Variance test cases:**

| Expected | Counted | Variance display |
|----------|---------|-----------------|
| 10 | 10 | 0 (green) |
| 10 | 8 | −2 (red) |
| 10 | 12 | +2 (orange) |
| 10 | — | — (not counted yet) |

---

### 27.7 Completing a Stock Take

**Log in as:** `admin@tenant-a.test`

1. Open a Stock Take in `in_progress` state
2. The **Actions** bar (only visible when status = `in_progress`) shows **Mark as Completed**
3. Click **Mark as Completed** → status changes to `completed` (green badge)
4. The action bar disappears — no further transitions available from the UI (approval is done out-of-band by the principal)

> **Note:** The `approved` status is set directly on the backend when the principal authorises the stock take report. UI support for principal approval can be added in a future iteration.

---

### 27.8 Stock Takes Tab — List View

From the **Stock Takes** tab on the Inventory page:

1. Filter by **Financial Year** (text input)
2. Columns: Reference, Title, Financial Year, Date, Conducted By, Status, Actions
3. Click **View** → opens Stock Take Detail page
4. Status badge colours:
   - **In Progress** → blue
   - **Completed** → green
   - **Approved** → purple

---

### 27.9 Low Stock Alerts

1. Go to the **Low Stock ⚠️** tab
2. Items at or below reorder level appear highlighted in red
3. The **Deficit** column shows how many units short of the reorder level the item is
4. Click a row → opens Item Detail page to record a receipt/restock

---

## 28. Updated Quick Smoke Test — Procurement & Inventory (10 minutes)

### Procurement flow (end-to-end)

1. Log in as `admin@tenant-a.test`
2. Navigate to 🛒 **Procurement → Requisitions** → click **+ New Requisition**
3. Fill PR Number, Title, Department → **Save PR** → status: `draft` ✓
4. Click **Submit to HOD** → status: `submitted` ✓
5. Log out → log in as `hod@tenant-a.test`
6. Open the same PR → click **HOD Recommend** → status: `hod_recommended`, info grid shows Recommended By ✓
7. Log out → log in as `principal@tenant-a.test`
8. Open the PR → click **Principal Approve** → status: `principal_approved`, info grid shows Approved By ✓
9. Log out → log in as `admin@tenant-a.test`
10. Open the PR → click **Convert to LPO** → status: `ordered` ✓
11. Navigate to **Orders** → click **+ New Local Purchase Order (LPO)** → verify title says "LPO Details" and field label says "LPO Number *" ✓
12. Open any LPO detail page → verify title reads "LPO: {number}" (not "PO:") ✓

### Inventory flow (end-to-end)

1. Log in as `admin@tenant-a.test`
2. Navigate to 📦 **Inventory** → **Items** tab → click **+ New Item** → save ✓
3. Go to **Issuances** tab → click **+ New Issuance** → fill in Department field → add items → **Save Issuance** ✓
4. In the Issuances table, verify **Department** column shows the value ✓
5. Click **Issue** on the draft issuance → status changes to Issued ✓
6. Go to **Stock Takes** tab → click **+ New Stock Take** → fill reference + financial year → add items → **Save Stock Take** ✓
7. On the Stock Take Detail page:
   - Verify variance column colours (red for shortage, green for match) ✓
   - Click **Mark as Completed** → status changes to Completed ✓
   - Action bar disappears ✓
8. Return to **Stock Takes** tab → verify status badge shows green "Completed" ✓



For a fast end-to-end check:

1. Open http://localhost:5173 → redirected to `/login`
2. Select **Greenfield VTI** tenant, enter `admin@tenant-a.test` / `Password123!` → click Sign In
3. **Dashboard** loads with welcome banner, KPI tiles, recent lists, quick actions ✓
4. Navigate to `/students` — 3 students visible (Alice, Brian, Carol) ✓
5. Click **"New Student"** → fill form → submit → student appears in list ✓
6. Navigate to `/admissions/new` → submit an application → appears with "submitted" badge ✓
7. Open the application → click **Shortlist → Interview → Accept** → badges update at each step ✓
8. Navigate to `/marks/new` → create a DRAFT submission ✓
9. Navigate to `/marks/bulk-entry` → select term + course → enter scores → **Save All** ✓
10. Navigate to `/finance/overview` → Overview tab shows 6 stat cards, Defaulters tab highlights blue when active ✓
11. Navigate to `/clearance` → paste a student UUID + term UUID → click **Init Clearance** → 8 departments appear → sign a few off ✓
12. Navigate to `/staff` → Jane Ndlovu and others visible, click one → detail page with contracts/attendance/appraisals tabs ✓
13. Navigate to `/reports/it` → page loads without crash, table displays ✓
14. Navigate to `/admin-studio` → config dashboard loads with branding + modules summary ✓
15. Switch to **Riverside Tech College** (header dropdown) → student list changes to David Osei + Eva Mensah ✓
16. Switch role to **instructor** (header dropdown) → sidebar shrinks to Dashboard + Students + Marks + Reports only ✓
17. Navigate to `/results` → select a term → click Process Results → GPA rankings table appears ✓
18. Switch role back to **admin** → navigate to `/analytics` → KPI tiles + breakdown tables load ✓

---

## 29. Full Role-Based E2E Procurement Test

**Estimated time: ~25 minutes**
**Tenant:** Greenfield VTI

This walks through the complete procurement lifecycle as four different users. Follow the steps in order.

---

### User Accounts

| Role | Email | Password |
|------|-------|----------|
| Finance Officer | `finance@tenant-a.test` | `Password123!` |
| Head of Department | `hod@tenant-a.test` | `Password123!` |
| Principal | `principal@tenant-a.test` | `Password123!` |
| Admin | `admin@tenant-a.test` | `Password123!` |

---

### Prerequisites — Create Test Data First

Do these two setup steps before beginning the workflow. Log in as `admin@tenant-a.test`.

#### A. Create a Supplier

1. Navigate to **Procurement → Suppliers**
2. Click **+ New Supplier** and fill in:

| Field | Value |
|-------|-------|
| Name | `ABC Office Supplies` |
| Contact Person | `John Banda` |
| Email | `john.banda@abcsupplies.test` |
| Phone | `+267-71-111-001` |
| Address | `Plot 123, Main Mall, Gaborone` |

3. Save → supplier appears in the Suppliers list

#### B. Create an Inventory Item

1. Navigate to **Inventory → Items** tab
2. Click **+ New Item** and fill in:

| Field | Value |
|-------|-------|
| Item Code | `STAT-A4-001` |
| Name | `A4 Paper Reams` |
| Category | `stationery` |
| Unit of Measure | `ream` |
| Reorder Level | `10` |
| Unit Cost (UGX) | `45` |

3. Save → item appears with **Current Stock: 0** and a ⚠️ Low Stock warning

---

### Dummy Requisition Values

Use these exact values when filling the PR form in Step 1:

| Field | Value |
|-------|-------|
| PR Number | `PR-2026/MT-001` |
| Title | `Stationery for ICT Department Q2` |
| Department | `ICT` |
| Requested By | `Finance Officer` |
| Priority | `Medium` |
| Academic Year | `2025/2026` |
| Required By | 14 days from today |

Line item to add:

| Field | Value |
|-------|-------|
| Description | `A4 Paper Reams` |
| Quantity | `20` |
| Unit | `ream` |
| Unit Price | `45.00` |

---

### Step 1 — Finance Creates the PR

**Log in as:** `finance@tenant-a.test`

1. Navigate to **Procurement → Requisitions**
2. Click **+ New Requisition**
3. Fill in all fields from the table above
4. Under **Items**, click **+ Add Item** and enter the line item values from the table above
5. Click **Save PR**
6. ✅ PR appears with status **Draft** (grey badge)

---

### Step 2 — Finance Submits the PR

*(Still logged in as Finance, on the same PR detail page)*

1. Click **Submit to HOD**
2. ✅ Status changes to **Submitted** (blue badge)
3. Note the PR number (`PR-2026/MT-001`) for the next steps

---

### Step 3 — HOD Recommends

**Log in as:** `hod@tenant-a.test`

1. Navigate to **Procurement → Requisitions**
2. Find `PR-2026/MT-001` (filter by status **Submitted** if needed)
3. Click to open the PR
4. Click **HOD Recommend**
5. ✅ Status changes to **HOD Recommended** (purple badge)
6. ✅ The info grid shows **Recommended By: hod@tenant-a.test** and a timestamp

---

### Step 4 — Principal Approves

**Log in as:** `principal@tenant-a.test`

1. Navigate to **Procurement → Requisitions**
2. Find `PR-2026/MT-001` (status: HOD Recommended)
3. Click to open the PR
4. Click **Principal Approve**
5. ✅ Status changes to **Principal Approved** (green badge)
6. ✅ The info grid shows **Approved By: principal@tenant-a.test** and a timestamp

---

### Step 5 — Finance Converts PR to LPO

**Log in as:** `finance@tenant-a.test`

1. Navigate to **Procurement → Requisitions**
2. Open `PR-2026/MT-001` (status: Principal Approved)
3. Click **Convert to LPO**
4. ✅ PR status changes to **Ordered (LPO Issued)** (teal badge)
5. ✅ A linked LPO button appears on the detail page (the PR is now locked for editing)

---

### Step 6 — Finance Creates the LPO

*(Still logged in as Finance)*

1. Navigate to **Procurement → Orders**
2. Click **+ New Local Purchase Order (LPO)**
3. Fill in:

| Field | Value |
|-------|-------|
| LPO Number | `LPO-2026/MT-001` |
| Title | `Stationery Purchase — ICT Dept Q2` |
| Supplier | `ABC Office Supplies` (select from dropdown) |
| Order Date | today |
| Expected Delivery | 7 days from today |

4. Under **Items**, click **+ Add Item**:

| Field | Value |
|-------|-------|
| Description | `A4 Paper Reams` |
| Quantity | `20` |
| Unit | `ream` |
| Unit Price | `45.00` |

5. Click **Save LPO**
6. ✅ LPO created with status **Draft**
7. ✅ Page title reads **LPO: LPO-2026/MT-001** (not "PO:")
8. ✅ Supplier field shows `ABC Office Supplies`

---

### Step 7 — Finance Issues the LPO

*(Still on the LPO detail page)*

1. Click **→ issued** (in the Transition Status bar)
2. ✅ LPO status changes to **issued** (blue badge)
3. ✅ The transition bar now shows options: **→ partial_received**, **→ received**, **→ cancelled**

---

### Step 8 — Finance Creates a GRN

*(Still logged in as Finance)*

1. Navigate to **Procurement → GRNs**
2. Click **+ New GRN**
3. Fill in:

| Field | Value |
|-------|-------|
| GRN Number | `GRN-2026/MT-001` |
| Received By | `Finance Officer` |
| Received Date | today |

4. Under **Items Received**, click **+ Add Item**:

| Field | Value |
|-------|-------|
| Description | `A4 Paper Reams` |
| Qty Received | `20` |
| Qty Ordered | `20` |
| Condition | `Good` |

5. Click **Save GRN**
6. ✅ GRN created with status **Draft** (grey badge)
7. ✅ Redirected to the GRN detail page showing the **✓ Confirm GRN** button

---

### Step 9 — Admin Confirms the GRN

**Log in as:** `admin@tenant-a.test`

1. Navigate to **Procurement → GRNs**
2. Find `GRN-2026/MT-001` (status: Draft)
3. Click to open it
4. Click **✓ Confirm GRN**
5. ✅ Status changes to **confirmed** (green badge)
6. ✅ The Confirm button disappears (no further transitions)

---

### Step 10 — Admin Records Stock Receipt

> **Note:** The UI does not yet have a "Record Receipt" form. Use the browser console to call the API directly.

1. Press **F12** to open DevTools → go to the **Console** tab
2. Paste and run the following script (it finds the item ID and records the receipt):

```js
const token = localStorage.getItem('amis_access_token');

// Find the inventory item
const resp = await fetch('/api/inventory/items?search=A4+Paper', {
  headers: { Authorization: `Bearer ${token}` }
});
const { data: items } = await resp.json();
const itemId = items[0].id;
console.log('Item ID:', itemId);

// Record the receipt
const txResp = await fetch('/api/inventory/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    item_id: itemId,
    transaction_type: 'receipt',
    quantity: 20,
    reference: 'GRN-2026/MT-001',
    notes: 'Received per confirmed GRN-2026/MT-001'
  })
});
const tx = await txResp.json();
console.log('Transaction created:', tx);
```

3. ✅ Console prints `Transaction created: { id: ..., transaction_type: "receipt", quantity: 20, balance_after: 20, ... }`
4. Navigate to **Inventory → Items** tab
5. ✅ `A4 Paper Reams` now shows **Current Stock: 20** (green, ⚠️ warning gone)
6. Click the item row → **Recent Transactions** table shows a `receipt` +20 entry

---

### Step 11 — Admin Creates a Store Issuance

*(Still logged in as Admin)*

1. Navigate to **Inventory → Issuances** tab
2. Click **+ New Issuance**
3. Fill in:

| Field | Value |
|-------|-------|
| Issuance Number | `ISS-2026/MT-001` |
| Issue Date | today |
| Issued To | `Moses Khumalo` |
| Issued By | `Admin Officer` |
| Department | `ICT` |
| Purpose | `Term 2 stationery supplies for ICT Lab` |
| Requisition Ref | `PR-2026/MT-001` |

4. Under **Items to Issue**, click **+ Add Item**:

| Field | Value |
|-------|-------|
| Item | `A4 Paper Reams (STAT-A4-001)` (select from dropdown) |
| Qty Requested | `15` |
| Qty Issued | `15` |

5. Click **Save Goods Issue Note**
6. ✅ Issuance created with status **Draft** (grey badge)
7. ✅ Visible in the Issuances tab with an **Issue** button

---

### Step 12 — Admin Dispatches the Issuance

1. In the **Issuances** tab, find `ISS-2026/MT-001` (status: Draft)
2. Click the **Issue** button on that row
3. ✅ Status changes to **Issued** (green badge)
4. ✅ The **Issue** button disappears
5. Navigate to **Inventory → Items** → `A4 Paper Reams`:
   - **Current Stock: 5** (20 received − 15 issued)
6. ✅ Navigate to **Inventory → Transactions** tab — two entries are visible:
   - `receipt` **+20** (green badge) — from Step 10
   - `issue` **−15** (red badge) — from this step

---

### Expected End State

| Record | Status |
|--------|--------|
| `PR-2026/MT-001` | Ordered (LPO Issued) |
| `LPO-2026/MT-001` | issued |
| `GRN-2026/MT-001` | confirmed |
| `ISS-2026/MT-001` | Issued |
| `A4 Paper Reams (STAT-A4-001)` | Current Stock: **5** |

---

### Bonus — Test Rejection Path

1. Log in as `finance@tenant-a.test` → create a **new** PR with number `PR-2026/REJECT-001` (same fields)
2. Click **Submit to HOD** → status: Submitted
3. Log in as `hod@tenant-a.test` → open the PR → click **Reject**
4. ✅ Status: **Rejected** (red badge)
5. Click **Close** → ✅ Status: **Closed** (grey badge)
6. No further action buttons appear

### Bonus — Invalid Transition Guard

1. Open any PR in `draft` state and note its URL (contains the UUID)
2. Open DevTools → Console and run:

```js
const token = localStorage.getItem('amis_access_token');
const prId = '<paste-pr-uuid-here>';
const r = await fetch(`/api/procurement/requisitions/${prId}/transition`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ status: 'principal_approved' })
});
console.log(r.status, await r.json());
```

3. ✅ Response: **422** — `"Invalid transition from draft to principal_approved"`

---

### Multi-Tenant Isolation Check

1. Switch to **Riverside Tech College** using the header tenant dropdown
2. Navigate to **Procurement → Requisitions** → `PR-2026/MT-001` is **not visible** ✅
3. Navigate to **Inventory → Items** → `A4 Paper Reams (STAT-A4-001)` is **not visible** ✅
4. Switch back to **Greenfield VTI** → all records reappear ✅
