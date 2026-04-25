# AMIS — Academic Management Information System
## Complete User Manual

**Version:** 3.0  
**Audience:** All system users (students, staff, administrators)  
**Platform:** Web browser (desktop recommended)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started — Login & Navigation](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Students](#4-students)
5. [Admissions](#5-admissions)
6. [Term Registrations](#6-term-registrations)
7. [Finance (Fees)](#7-finance-fees)
8. [Marks & Assessments](#8-marks--assessments)
9. [End-of-Term Results](#9-end-of-term-results)
10. [Attendance](#10-attendance)
11. [Timetable](#11-timetable)
12. [Programmes](#12-programmes)
13. [Courses & Curriculum](#13-courses--curriculum)
14. [Staff (HR)](#14-staff-hr)
15. [Industrial Training](#15-industrial-training)
16. [Field Placements](#16-field-placements)
17. [Clearance](#17-clearance)
18. [Alumni](#18-alumni)
19. [Analytics](#19-analytics)
20. [Reports](#20-reports)
21. [Admin Studio (Configuration)](#21-admin-studio)
22. [Platform Admin](#22-platform-admin)
23. [Public Application Portal](#23-public-application-portal)
24. [User Roles & Permissions](#24-user-roles--permissions)
25. [Troubleshooting](#25-troubleshooting)

---

## 1. Introduction

AMIS is a multi-tenant Academic Management Information System designed for technical and vocational education institutions. It manages the full student lifecycle — from public admission applications through enrolment, marks, fees, clearance, and alumni tracking — while supporting multi-institute deployments from a single platform.

### Key Concepts

| Term | Meaning |
|------|---------|
| **Tenant** | A single institution (e.g., Kasese Technical Institute) |
| **Academic Year** | A calendar year of study (e.g., 2025/2026) |
| **Term** | A study period within an academic year (Term 1, 2, 3) |
| **Programme** | A course of study (e.g., Diploma in ICT) |
| **Intake** | The year a student cohort was admitted (e.g., 2024) |
| **Submission** | A batch of marks submitted by an instructor |

---

## 2. Getting Started

### 2.1 Logging In

1. Open your browser and navigate to your institution's AMIS URL.
2. On the login page, enter your **Organisation slug** (e.g., `kti`), your **email address**, and **password**.
3. Click **Sign In**.

> **Forgot your password?** Click **Forgot password?** below the sign-in button. Enter your email address — you will receive a reset link within a few minutes.

### 2.2 Resetting a Password

1. Click the link in the password-reset email.
2. Enter and confirm your new password.
3. Click **Reset Password** — you will be redirected to login.

### 2.3 Main Navigation

After login, the left-hand sidebar lists all modules available to your role. The top header shows:
- **Institute logo and name**
- Your current role badge
- A settings/profile link

Clicking any sidebar item navigates to that module. The current page is highlighted with a coloured left border.

---

## 3. Dashboard

**Who sees it:** All roles

The Dashboard is the home screen. It shows:

| Card | Description |
|------|-------------|
| **Welcome banner** | Greeting with your name, role, and today's date |
| **Total Students** | Count of active enrolled students |
| **Pending Admissions** | Applications awaiting review |
| **Pending Registrations** | Term registrations not yet completed |
| **Pending Marks** | Mark submissions awaiting approval |
| **Staff** | Number of active staff records |
| **Programmes** | Active programmes offered |
| **Fee Overview** | Total collected vs total due (finance roles) |

The **Quick Links** panel at the bottom provides one-click access to the most common actions for your role (e.g., New Student, Record Payment, Bulk Marks Entry).

---

## 4. Students

**Who can access:** Admin, Registrar, Dean, HOD, Instructor, Finance, Principal

### 4.1 Viewing the Student List

Navigate to **Students** in the sidebar.

The list shows all active students by default. Use the filter bar to:
- **Search** by name or admission number
- **Filter by Academic Year** — select a year of study (Year 1, 2, …)
- **Filter by Programme** — narrow to a specific programme
- **Show Inactive** — toggle to include deactivated student records

Click any row to open the student's full profile.

### 4.2 Creating a Student

1. Click **+ New Student**.
2. Fill in the required fields:
   - First Name, Last Name
   - Admission Number (must be unique within the institution)
   - Programme and intake year
   - Date of Birth, Gender, Nationality
3. Optional fields: contact details, guardian information, district, dropout reason.
4. Click **Save**.

### 4.3 Student Detail Page

The detail page shows all information about a student across tabs:

- **Profile** — personal and contact details
- **Fees** — fee balance and payment history
- **Marks** — submitted mark records
- **Term Registrations** — registration history per term
- **Documents** — uploaded supporting documents
- **Clearance** — clearance status per term

Use the **Edit** button to update any information. Use **Deactivate** to mark a student as inactive without deleting them.

### 4.4 Importing Students (Bulk Upload)

1. Click **Import Students** (top right of the student list).
2. Download the **CSV template**.
3. Fill in the template — each row is one student.
4. Upload the completed CSV file.
5. Review the preview table showing detected rows.
6. Click **Import** to create all records.

Rows with errors (e.g., duplicate admission numbers) are flagged; valid rows are imported.

### 4.5 Student Promotion

1. Click **Promote Students** from the student list page.
2. Select the source academic year/term and the target year.
3. Select the students to promote (or select all).
4. Click **Promote** — each student's year of study is incremented.

---

## 5. Admissions

**Who can access:** Admin, Registrar, Principal

The Admissions module manages applications from prospective students.

### 5.1 Admission Workflow States

```
DRAFT → SUBMITTED → UNDER_REVIEW → COMMITTEE_REVIEW
    → APPROVED_GOVT / APPROVED_PRIVATE → ENROLLED
    → REJECTED (at any review stage)
```

### 5.2 Viewing Applications

Navigate to **Admissions**. Filter by:
- **Search** — name or reference number
- **Programme**
- **Intake year**
- **State** — filter by current workflow stage

### 5.3 Creating an Application (Manual Entry)

1. Click **+ New Application**.
2. Enter applicant details: name, programme, intake, email, phone.
3. Add academic qualifications.
4. Click **Save as Draft**.

Applications can also arrive via the **Public Portal** (see section 23).

### 5.4 Processing an Application

Open an application. Use the **Transition** buttons to move it through the workflow:
- **Submit** — moves DRAFT → SUBMITTED
- **Start Review** — moves SUBMITTED → UNDER_REVIEW
- **Escalate to Committee** — moves UNDER_REVIEW → COMMITTEE_REVIEW
- **Approve (Government)** / **Approve (Private)** — marks as approved
- **Reject** — closes the application
- **Enrol** — converts the approved applicant into a student record

### 5.5 Importing Applications (Bulk)

1. Click **Import Applications**.
2. Download the CSV template.
3. Fill in and upload.
4. Imported applications arrive in DRAFT state.

---

## 6. Term Registrations

**Who can access:** Admin, Registrar, Dean

Term registration is the process of officially enrolling a student for a specific term. It follows a multi-step workflow.

### 6.1 Registration Workflow States

```
REGISTRATION_STARTED
→ DOCUMENTS_VERIFIED
→ FEES_VERIFIED
→ GUILD_FEES_VERIFIED
→ DEAN_ENDORSED
→ HALL_ALLOCATED
→ CATERING_VERIFIED
→ MEDICAL_CHECKED
→ LIBRARY_CARD_ISSUED
→ ONLINE_REGISTERED
→ EXAM_ENROLLED
→ CLEARANCE_ISSUED
```

Each department signs off its own step. The workflow is configured in Admin Studio (section 21.7).

### 6.2 Creating a Registration

1. Navigate to **Term Registrations → + New Registration**.
2. Select the student (type to search).
3. Select the academic year, term, and programme.
4. Click **Save** — the registration is created at REGISTRATION_STARTED.

### 6.3 Advancing a Registration

Open a registration record and click the appropriate transition button (e.g., **Verify Documents**, **Verify Fees**, **Dean Endorse**). Each step may be restricted to certain roles.

### 6.4 Bulk Registration

1. Navigate to **Term Registrations → Bulk Register**.
2. Select the term and programme.
3. Choose students from the list (checkbox or select all).
4. Click **Register All** — creates REGISTRATION_STARTED records for all selected students at once.

---

## 7. Finance (Fees)

**Who can access:** Admin, Finance, Principal (read-only for others)

### 7.1 Fee Ledger (Per-Student)

Navigate to **Finance**.

1. Search for a student by name or admission number and select them.
2. The summary cards show:
   - **Total Due** — expected fees for the term
   - **Total Paid** — amount received
   - **Balance** — outstanding amount
   - **Status** — PAID / PARTIAL / OWING (colour-coded)
3. The transaction table below lists every payment with date, amount, method, and reference.

### 7.2 Recording a Payment

1. From the Finance page, click **Record Payment** (or navigate to **Finance → Fee Entry**).
2. Select the student.
3. Enter:
   - Amount
   - Payment method (cash, bank draft, mobile money, SchoolPay)
   - Reference number / receipt number
   - Payment date
4. Click **Save**.

### 7.3 Importing Fee Payments (Bulk)

1. Navigate to **Finance → Import**.
2. Download the CSV template.
3. Fill in payments and upload.
4. Review and confirm.

### 7.4 Fee Overview (Institution-Wide)

Navigate to **Finance → Overview**.

Summary cards show:
- Total students
- Total expected revenue
- Total collected
- Collection rate (%)
- Fully paid count
- Defaulters count

Below the cards, a **Defaulters Table** lists students with outstanding balances — filterable by programme and term.

### 7.5 SchoolPay Reconciliation

Navigate to **Finance → Reconciliation**.

This page lists incoming payments received via the SchoolPay platform that have not yet been matched to a student.

1. Find an unmatched transaction.
2. Click **Match**.
3. Enter or search for the student.
4. Click **Confirm Match** — the payment is linked to the student's ledger.

Filter by **Matched / Unmatched / All**.

### 7.6 Fee Receipt

Navigate to **Finance → Receipt** to print or preview a fee receipt for a student and term.

---

## 8. Marks & Assessments

**Who can access:**
- **Instructor** — create and submit their own submissions
- **HOD** — review and approve submissions for their department
- **Registrar / Admin** — full access

### 8.1 Marks Workflow States

```
DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED
```

### 8.2 Viewing Submissions

Navigate to **Marks**. Filter by programme, intake, or term. Each row shows the submission batch with its current state.

### 8.3 Creating a Mark Submission

1. Click **+ New Submission**.
2. Select the programme, term, course, and intake.
3. Click **Save**.
4. Open the created submission and click **Add Entries** (or use Bulk Entry).

### 8.4 Bulk Mark Entry

1. Navigate to **Marks → Bulk Entry**.
2. Select programme, term, and course.
3. The page loads all registered students for that combination.
4. Enter marks directly in the table (coursework, exam, total calculated automatically).
5. Click **Save All** to persist the entries.

### 8.5 Submitting for Review

Open a submission in DRAFT state. Click **Submit** — it moves to HOD_REVIEW.

### 8.6 HOD Review

Open a SUBMITTED submission. Review entries. Click:
- **Approve** — moves to APPROVED
- **Return to Draft** — sends back for correction

### 8.7 Publishing Marks

An Admin or Registrar opens an APPROVED submission and clicks **Publish** — students can now see their marks in the results module.

---

## 9. End-of-Term Results

**Who can access:** Admin, Registrar, Principal, Dean

Navigate to **Results**.

### 9.1 Processing Results

1. Select the term from the dropdown.
2. Click **Process Results** — the system calculates GPA for each student based on published marks and configured grading scales.
3. The table shows each student's GPA and pass/fail status.

Summary cards display average GPA, pass rate, and student count.

### 9.2 Results Slip

Navigate to **Results → Result Slip**.

1. Select a student and term.
2. Click **Preview** to view the formatted results slip.
3. Click **Print** or save as PDF.

### 9.3 Transcript

Navigate to **Results → Transcript**.

Select a student to generate a full academic transcript covering all completed terms.

---

## 10. Attendance

**Who can access:** Instructor, HOD, Admin, Registrar, Dean

Navigate to **Attendance**.

### 10.1 Taking Attendance

1. Select:
   - Programme
   - Academic Year
   - Term
   - Course
   - Date (defaults to today)
2. Click **Load Sheet**.
3. The attendance sheet lists all registered students for the selected course.
4. For each student, set the status:
   - **P** — Present
   - **A** — Absent
   - **L** — Late
   - **E** — Excused
5. Add optional notes per student.
6. Click **Save Attendance**.

### 10.2 Attendance Summary

Switch to the **Summary** tab to view attendance rates per student across a date range, showing percentage attendance and absences.

---

## 11. Timetable

**Who can access:** Admin, Registrar, HOD, Instructor (view)

Navigate to **Timetable**.

### 11.1 Viewing the Timetable

1. Select the academic year, programme, and optionally filter by term.
2. The timetable renders as a weekly grid (Monday–Friday) with colour-coded slots per course.
3. Each slot shows: course name, room, instructor, and time.

### 11.2 Adding a Slot

1. Click **+ Add Slot** or click an empty cell.
2. Fill in:
   - Day of week
   - Start time / End time
   - Course
   - Room (optional)
   - Instructor name (optional)
   - Notes (optional)
3. Click **Save**.

### 11.3 Editing / Deleting a Slot

Click a slot to open the edit modal. Modify details and click **Update**, or click **Delete** to remove the slot.

---

## 12. Programmes

**Who can access:** Admin, Registrar, Principal

Navigate to **Programmes**.

### 12.1 Viewing Programmes

The list shows all programmes with code, title, department, level, and duration. Click a row to view the full programme detail including its associated courses.

### 12.2 Creating a Programme

1. Click **+ New Programme**.
2. Enter:
   - Code (short identifier, e.g., `DICT`)
   - Title (full name)
   - Department
   - Level (Certificate, Diploma, etc.)
   - Duration in months
3. Click **Save**.

### 12.3 Programme Detail

The programme detail page shows:
- Overview (code, title, department, level, duration)
- **Courses** tab — list of courses assigned to this programme
- Option to add courses directly from this page

---

## 13. Courses & Curriculum

**Who can access:** Admin, Registrar, HOD

Courses are managed within the Programme Detail page. Each course has:
- Code and title
- Credit units
- Year of study and term
- Is it a core or elective course?

---

## 14. Staff (HR)

**Who can access:** Admin, Principal

Navigate to **Staff**.

### 14.1 Viewing Staff

The list shows all staff members. Search by name. Filter by employment type (Full-time, Part-time, Contract, Temporary).

### 14.2 Adding a Staff Member

1. Click **+ New Staff**.
2. Fill in:
   - First Name, Last Name (required)
   - Email, Phone
   - Staff Number
   - Department, Designation
   - Employment Type
   - Join Date
   - Salary (optional)
3. Click **Save**.

### 14.3 Staff Detail Page

Click a staff record to view:
- Personal and contact information
- Employment details
- Department and role
- Edit all fields inline

---

## 15. Industrial Training

**Who can access:** Admin, Registrar, Instructor, HOD

Navigate to **Industrial Training**.

Industrial Training (IT) records track students placed at external organisations for on-the-job training.

### 15.1 Creating a Record

1. Click **+ New Record**.
2. Select the student.
3. Enter:
   - Company / Host Organisation
   - Supervisor name and contact
   - Start date and end date
   - Status (Scheduled, Active, Completed, Cancelled)
4. Click **Save**.

### 15.2 Updating Status

Open a record and change the status dropdown. Save changes.

---

## 16. Field Placements

**Who can access:** Admin, Registrar, Instructor

Navigate to **Field Placements**.

Similar to Industrial Training but for academic field placement (e.g., teaching practice, hospital attachments).

- Create, view, and update placement records per student.
- Track placement location, supervisor, and dates.

---

## 17. Clearance

**Who can access:** Admin, Registrar, Dean, HOD, Finance (each signs their own department)

Navigate to **Clearance**.

Clearance confirms a student has fulfilled all obligations before end of term or graduation.

### 17.1 Initiating Clearance

1. Search for and select a student.
2. Select the term.
3. Click **Initiate Clearance** — creates clearance records for all departments.

### 17.2 Department Sign-Off

Each department signs off its own step:

| Department | Responsibility |
|-----------|---------------|
| Store | Equipment/materials returned |
| Library | Books returned |
| Sports | Sports equipment returned |
| Warden | Hostel room cleared |
| Head of Department | Academic requirements met |
| Dean of Students | General conduct verified |
| Accounts (Finance) | Fees fully paid |
| Academic Registrar | Enrolment documents complete |

1. Open a student's clearance record.
2. Find your department row.
3. Click **Sign Off** (green) or **Reject** (red).
4. Add optional remarks.
5. Click **Confirm**.

A student is fully cleared when all departments have signed off.

---

## 18. Alumni

**Who can access:** Admin, Registrar, Principal

Navigate to **Alumni**.

### 18.1 Viewing Alumni

Search by name or student number. Alumni records are created automatically when a student completes their programme.

### 18.2 Alumni Detail

View contact details, graduation year, programme, and employment history (if recorded).

### 18.3 Exporting Alumni Data

Click **Export CSV** (top right of alumni list) to download all alumni records as a spreadsheet.

---

## 19. Analytics

**Who can access:** Admin, Principal, Registrar

Navigate to **Analytics**.

### 19.1 Term Analytics

1. Select the academic year and term.
2. The system displays cross-module statistics:

| Metric | Description |
|--------|-------------|
| Total Students | Enrolled this term |
| Total Applications | Admissions received |
| IT Placements | Students on industrial training |
| Mark Submissions | Submissions in each state |
| Fee Collection Rate | % of expected fees collected |
| Attendance Rate | Average attendance across courses |

Use these for term performance reporting.

---

## 20. Reports

**Who can access:** Varies by report type

Navigate via the sidebar under **Reports**.

### 20.1 IT Reports

Navigate to **Reports → Industrial Training**.

Create and view supervisor and student evaluation reports for industrial training placements. Reports are linked to a specific IT record and include rating scores and narrative feedback.

### 20.2 Teacher Evaluations

Navigate to **Reports → Evaluations**.

Record and view instructor performance evaluations submitted by HODs or students.

### 20.3 Instructor Reports

Navigate to **Reports → Instructor Reports**.

Instructors submit term-end reports on their courses including challenges faced, completion rates, and recommendations.

### 20.4 Class List

Navigate to **Reports → Class List**.

Generate a printable class list (register) for any programme/term combination. Shows student names, admission numbers, and signature columns.

### 20.5 Fee Collection Report

Navigate to **Reports → Fee Collection**.

1. Set optional filters: programme, term, date range.
2. Click **Apply**.
3. The report shows every payment transaction matching the filters.
4. Click **Export CSV** to download for accounting purposes.

### 20.6 NCHE Enrolment Report

Navigate to **Reports → NCHE Enrolment**.

Generates the National Council for Higher Education enrolment report in the required format, showing student counts per programme and year of study.

### 20.7 Marks Analysis

Navigate to **Reports → Marks Analysis**.

Shows pass/fail distribution, GPA distribution, and top-performing students per programme and term.

---

## 21. Admin Studio

**Who can access:** Admin only

Navigate to **Admin Studio** via the top navigation bar (gear/settings icon) or direct URL `/admin-studio`.

Admin Studio is the configuration hub for the entire system. Changes made here are versioned — they go through a Draft → Validate → Publish cycle.

> **Important:** Configuration changes only take effect after they are **Published**.

---

### 21.1 Config Dashboard

The landing page of Admin Studio. Shows:
- Current published config version and timestamp
- Whether a draft exists
- Quick-access buttons to all configuration sections

---

### 21.2 Institute Profile

Navigate to **Admin Studio → Institute Profile**.

Set your institution's:
- Full name
- Short name / acronym
- Logo URL
- Physical address
- Contact email and phone
- Website URL
- Country, district

---

### 21.3 Branding & Theme

Navigate to **Admin Studio → Branding**.

Customise the visual appearance:
- **Primary colour** — main button and accent colour (hex code, e.g., `#2563EB`)
- **Secondary colour**
- **Logo URL** — link to hosted institution logo
- **Font family** — select from available web fonts

Changes preview live before publishing.

---

### 21.4 Module Toggles

Navigate to **Admin Studio → Modules**.

Enable or disable system modules for your institution. Disabled modules are hidden from all users' navigation.

| Module | Default |
|--------|---------|
| Admissions | On |
| Finance | On |
| Marks | On |
| Industrial Training | On |
| Attendance | On |
| Timetable | On |
| Clearance | On |
| Alumni | On |
| Analytics | On |

---

### 21.5 Navigation Editor

Navigate to **Admin Studio → Navigation**.

Customise the sidebar navigation for each role:
- Drag to reorder menu items
- Add custom links
- Set visibility per role (Admin, Registrar, Finance, Dean, HOD, Instructor, Principal)
- Set icons

Use the **Role Tabs** to switch between role views. Click **Copy from Role** to duplicate another role's layout as a starting point.

---

### 21.6 Academic Calendar

Navigate to **Admin Studio → Academic Calendar**.

#### Academic Years
- **Create Academic Year** — enter name (e.g., `2025/2026`), start date, end date.
- **Mark as Current** — sets this as the active year used by default across the system.

#### Terms
- Each academic year has terms. Select a year and click **+ Add Term**.
- Enter: name (e.g., `Term 1`), term number (1/2/3), start date, end date.
- **Mark Term as Current** — sets the active term.

---

### 21.7 Workflow Editor

Navigate to **Admin Studio → Workflows**.

Workflows define the state machines for:
- Admissions applications
- Term registrations
- Mark submissions

Each workflow shows:
- **States** — the list of possible stages
- **Transitions** — which role can trigger which state change
- **Required Role** — the role that must perform each transition

View the current published workflow and compare against draft changes.

---

### 21.8 Student Form Editor

Navigate to **Admin Studio → Student Form**.

Control which fields appear on the student creation/edit form:
- Toggle fields on or off
- Mark fields as required
- Reorder fields
- Add custom fields

---

### 21.9 Admission Form Editor

Navigate to **Admin Studio → Admission Form**.

Configure the public application form:
- Control visible fields
- Set required fields
- Add programme-specific questions

---

### 21.10 Fee Structure Editor

Navigate to **Admin Studio → Fee Structures**.

Define the official fee schedule per programme, academic year, and term.

#### Creating a Fee Structure

1. Click **+ Add Fee Structure**.
2. Select:
   - Academic Year
   - Term (leave blank for a year-level fee)
   - Programme
   - Fee Type: Tuition, Functional, Examination, Other
   - **Student Category**: All Students / Boarding / Day Scholar
   - Amount
   - Currency (default: UGX)
3. Add an optional description.
4. Click **Create**.

#### Student Categories

| Category | Meaning |
|----------|---------|
| All Students | Applies to both boarding and day scholars |
| Boarding | Only for residential students (higher rate) |
| Day Scholar | Only for non-residential students (lower rate) |

**Example (KTI 2025/2026):**

| Fee Type | Boarding | Day Scholar | Frequency |
|----------|----------|-------------|-----------|
| Tuition + Hostel + Utilities | UGX 689,000 | UGX 539,000 | Per term |
| Guild Fee | UGX 15,000 | UGX 15,000 | Per term |
| Admission Fee | UGX 10,000 | UGX 10,000 | Once |
| Uniform | UGX 65,000 | UGX 65,000 | Once |
| Institute ID | UGX 15,000 | UGX 15,000 | Once |

#### Editing / Deactivating

- Click **Edit** on any row to change amounts or description.
- Click **Deactivate** to disable a fee without deleting it (inactive fees are hidden from the active view but preserved historically).

---

### 21.11 Grading Scale Editor

Navigate to **Admin Studio → Grading**.

Define the grading scale used to convert marks to grades and GPA:

| Min % | Max % | Grade | GPA Points | Remark |
|-------|-------|-------|------------|--------|
| 80 | 100 | A | 4.0 | Distinction |
| 70 | 79 | B | 3.0 | Credit |
| 60 | 69 | C | 2.0 | Pass |
| 50 | 59 | D | 1.0 | Bare Pass |
| 0 | 49 | F | 0.0 | Fail |

Click **+ Add Grade** to add a row. Edit values inline. Click **Save** and then **Publish** to apply.

---

### 21.12 Dashboard Widgets Editor

Navigate to **Admin Studio → Dashboards**.

Configure which metric cards appear on the dashboard for each role:

1. Select a role tab (Admin, Registrar, Finance, etc.).
2. Check or uncheck available widgets:
   - Total Students
   - Pending Admissions
   - Fee Collection Rate
   - Pending Marks
   - IT Placements
   - Attendance Rate
   - (and more)
3. Click **Save Draft**, then **Publish**.

---

### 21.13 Publishing Configuration

All Admin Studio changes are saved as a **draft** until published.

1. Make changes across any configuration sections.
2. Navigate back to the **Config Dashboard**.
3. Click **Validate** — the system checks all schemas for errors.
4. If validation passes, click **Publish** — the new config goes live immediately.
5. If you need to undo, click **Rollback** to revert to the previously published version.

---

### 21.14 Studio Users

Navigate to **Admin Studio → Users**.

Manage system user accounts:
- View all users and their roles
- Deactivate / reactivate users
- Change a user's role
- Create new user accounts

---

## 22. Platform Admin

**Who can access:** Platform superadmin only

Navigate to `/platform-admin`.

Platform Admin is for the team that hosts and manages multiple institutions on the same AMIS instance.

### 22.1 Platform Overview

Shows high-level stats across all tenants:
- Number of active institutions
- Total users across all tenants
- Recent activity

### 22.2 Tenant Manager

View and manage all registered institutions:
- Name, slug, status
- Date created
- Link to configure per-tenant settings

### 22.3 Provision a New Institution

1. Navigate to **Platform Admin → Provision**.
2. Enter:
   - Institution name
   - Slug (short URL identifier, e.g., `kti`)
   - Admin email address
   - Region/country
3. Click **Provision** — creates the tenant, initialises the database schema, and sends a welcome email to the admin.

---

## 23. Public Application Portal

**No login required**

Prospective students can apply online via:

```
https://[your-domain]/apply/[institution-slug]
```

For example: `https://amis.example.com/apply/kti`

### How to Apply

1. Open the application URL.
2. Fill in:
   - First name and last name
   - Programme of interest (selected from a dropdown)
   - Intake year
   - Email address (optional)
   - Phone number (optional)
3. Click **Submit Application**.
4. A reference number is shown — note this for follow-up.

The application appears in the Admissions module in DRAFT state, ready for staff review.

---

## 24. User Roles & Permissions

Each user is assigned a single role. Role determines which modules they can see and which actions they can perform.

| Role | Key Permissions |
|------|----------------|
| **admin** | Full access to all modules + Admin Studio |
| **registrar** | Students, Admissions, Term Registrations, Programmes, Results, Academic Calendar, Users (read) |
| **finance** | Finance (full), Fee Structures (read), Students (read) |
| **principal** | All modules read-only + Analytics + Reports |
| **dean** | Term Registrations (sign-off), Students (view), Clearance (Dean step) |
| **hod** | Marks (review/approve), Courses, Staff (view), Clearance (HOD step) |
| **instructor** | Marks (own submissions), Attendance, Timetable (view), IT Records |

> Roles are assigned by an Admin via **Users** or **Admin Studio → Users**.

---

## 25. Troubleshooting

### "Failed to load" / blank list pages

The data failed to fetch from the server.
- Check your internet connection.
- Try refreshing the page (Ctrl+R / Cmd+R).
- If the problem persists, contact your system administrator.

### "422 Unprocessable Entity" error

A form field contains an invalid value.
- Check all required fields are filled in.
- Ensure numbers are within valid ranges.
- Dates must be in YYYY-MM-DD format.

### Login fails with "Invalid credentials"

- Check you are using the correct organisation slug.
- Verify your email and password.
- Use **Forgot Password** to reset.
- Contact admin if your account has been deactivated.

### Config changes not taking effect

Admin Studio changes only go live after being **Published**.
- Go to Admin Studio → Config Dashboard.
- Click **Publish** if a draft is pending.

### Marks not appearing in Results

Marks must be in **PUBLISHED** state to appear in results processing.
- Navigate to **Marks**, find the submission, and check its state.
- An Admin or Registrar must click **Publish** on the approved submission.

### Fee balance showing incorrectly

- Ensure the Fee Structure for the relevant academic year, term, and programme is correctly configured in Admin Studio.
- Ensure payments are recorded against the correct term.

### Can't see a module in the sidebar

- Your role may not have access to that module.
- The module may have been disabled in Admin Studio → Modules.
- Contact your Admin to adjust role permissions or re-enable the module.

---

*For technical support, contact your system administrator or the AMIS support team.*
