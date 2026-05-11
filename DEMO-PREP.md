# AMIS Demo Preparation — May 8, 2026 (11:00 AM – 12:00 PM)

**Audience:** ICT/D4D colleagues (Thalia, BART, Amos, Daniel, Ambrose, John, Emmanuel, Evaluation, Irene)
**Platform:** Microsoft Teams — [Join Meeting](https://teams.microsoft.com/meet/347588297445626?p=1alp3Zv9dHhSIVyy18)
**Purpose:** Evaluate AMIS functionality as an Academic Management Information System for TVET institutions

---

## Pre-Demo Checklist (complete by 10:45 AM)

```
□ Run: pnpm dev (from repo root c:\Users\DELL\amis-multi-tenant)
□ Open browser at http://localhost:5173
□ Test login: admin@tenant-a.test / Password123!  ✓
□ Test login: agabag56@gmail.com / KTI@Change2026!  ✓
□ Set browser zoom to 110–125% for readability on screen share
□ Close unneeded tabs and notifications
□ Join Teams meeting early — test screen share + audio before 11am
□ Keep this file open on a second monitor or phone as notes
```

---

## Login Credentials

### Greenfield VTI — primary demo tenant (`tenant-a.test`)
> **Password for all:** `Password123!`

| Role | Email | Sidebar Access |
|---|---|---|
| **admin** | `admin@tenant-a.test` | Everything — use for most of the demo |
| registrar | `registrar@tenant-a.test` | Students, Admissions, Programmes, Marks, Term Reg |
| finance | `finance@tenant-a.test` | Finance only |
| hod | `hod@tenant-a.test` | Marks, Programmes, Staff |
| instructor | `instructor@tenant-a.test` | Marks, Attendance |
| principal | `principal@tenant-a.test` | Read-only overview across modules |
| dean | `dean@tenant-a.test` | Students, Term Registrations, Results |

### Kasese Technical Institute — real institution data
> 404 real students · 10 UVTAB-accredited programmes

| Email | Password | Role |
|---|---|---|
| `agabag56@gmail.com` | `KTI@Change2026!` | admin |
| `fortunateazairwe032@gmail.com` | `KTI@Change2026!` | registrar |
| `muhindosamuel0@gmail.com` | `KTI@Change2026!` | finance |
| `twesigyeisa@gmail.com` | `KTI@Change2026!` | HOD (Building Construction) |
| `olwochdkoma@gmail.com` | `KTI@Change2026!` | dean / principal |

---

## 1-Hour Demo Script

### [0:00 – 0:05] Opening & System Overview
- Open `http://localhost:5173` — login as `admin@tenant-a.test` / `Password123!`
- Show the dashboard and role badge in the header
- **Say:** _"AMIS is a multi-tenant Academic Management Information System. Each institution — VTI, Technical College, University — gets its own isolated environment with custom branding, navigation, and workflows, all on shared infrastructure."_

---

### [0:05 – 0:15] Student Management
1. Click **Students** → show the searchable list with filters
2. Click **+ New Student** → walk through the **4-tab form**:
   - Tab 1: Bio Data (name, DOB, gender, NIN, admission number)
   - Tab 2: Placement (programme, year of study, sponsorship, intake year)
   - Tab 3: Guardian / Next of Kin
   - Tab 4: UVTAB Exam Registration (registration number, assessment level)
   - **Say:** _"Previously this was a single long form — we reorganised it into logical sections to reduce errors during data entry."_
3. **Bulk Import demo:**
   - Click **Import** on the Students list
   - Upload `DEMO-IMPORT-STUDENTS.csv` (in repo root)
   - Show the column mapping step
   - Show the **"Update existing record"** toggle
   - **Say:** _"Institutions migrating from spreadsheets can import hundreds of students at once. If a student already exists, you can choose to skip or update their record."_

---

### [0:15 – 0:25] Programmes & Admissions
1. Click **Programmes** → show the list (Greenfield VTI has 7 programmes)
2. Click **📋 Browse TVET Catalogue**:
   - Show the searchable list of National Certificates, HNDs, Diplomas, CBETs
   - Select a programme — watch the form prefill automatically
   - **Say:** _"All UVTAB-accredited qualifications are pre-loaded. The registrar just selects and confirms — no free-text entry for regulated programmes."_
3. Click **Admissions** → show the application list
   - Show the workflow states: Submitted → Shortlisted → Interview → Accepted / Rejected
   - **Say:** _"Each step in the admissions process is tracked and auditable."_

---

### [0:25 – 0:35] Term Registrations & Marks Workflow
1. Click **Term Registrations** → show students being registered for the current term
   - Show status: REGISTRATION_STARTED → FEE_PAID → CLEARED → COMPLETED
2. Click **Marks** → show the mark entry interface
   - Show workflow states: DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED
   - **Say:** _"Instructors enter marks as drafts. The HOD reviews and approves. Only then are results published. The full chain is configurable per institution."_

---

### [0:35 – 0:42] Finance Module
- Switch to finance role: logout → login as `finance@tenant-a.test` / `Password123!`
- **Notice:** Sidebar shows **only Finance** — no student records, no marks
- Show fee structures, payment recording, reconciliation
- **Say:** _"Role-based access is enforced at the database level using Row-Level Security — not just hidden in the UI. A finance user literally cannot query student personal data."_

---

### [0:42 – 0:50] Admin Studio — Institution Customisation
- Switch back to `admin@tenant-a.test`
- Navigate to **Admin Studio** (bottom of sidebar or `/admin-studio`)

1. **Module Toggles** — show enabling/disabling entire modules (Finance, Admissions, etc.)
   - **Say:** _"A small VTI might not need the Finance module yet. One toggle disables it completely for all users."_

2. **Navigation Editor** — show adding/removing/reordering links per role
   - **Say:** _"Each role gets a fully customised sidebar. The admin drags and drops to configure it — no code deployment needed."_

3. **Workflow Configuration** — show the visual state flow
   - Marks: `DRAFT → SUBMITTED → HOD_REVIEW → APPROVED → PUBLISHED`
   - **Say:** _"A larger institution with an Academic Board might add an extra BOARD_REVIEW state. A smaller one can collapse to three steps. All configured here."_
   - Show the **↺ Reset to Defaults** button

---

### [0:50 – 0:56] Multi-Tenancy — Real KTI Data
- Logout → login as `agabag56@gmail.com` / `KTI@Change2026!`
- **Say:** _"Now we're inside Kasese Technical Institute — a real VTI in Uganda. Completely separate data, separate config, same platform."_
- Show **Students** → 404 real students with UVTAB admission numbers
- Show **Programmes** → NCBC, NCPL, NCAM, NCES, NCAP (2-year national certificates) + short courses
- **Say:** _"The data isolation is absolute. KTI cannot see Greenfield's students, and vice versa — guaranteed by PostgreSQL Row-Level Security, not application code."_

---

### [0:56 – 1:00] Q&A

---

## Key Talking Points

| Topic | What to say |
|---|---|
| **Multi-tenancy** | One deployment serves all 5 VTIs simultaneously. Zero data leakage between institutions. |
| **TVET Act compliance** | Every captured field maps to a specific requirement under the TVET Act / CoVE framework. |
| **Role-based access** | Enforced at the DB level (PostgreSQL RLS). Not just hidden buttons — physically blocked queries. |
| **Customisation without code** | Navigation, modules, workflows, branding — all configurable by the institution admin. |
| **Data migration** | CSV import with upsert support means institutions can migrate from spreadsheets gradually. |
| **Offline deployment** | The system can be deployed standalone per institution for low-connectivity environments. |

---

## Demo Import File

Use `DEMO-IMPORT-STUDENTS.csv` (in repo root) for the bulk import step.

It contains 10 realistic new students with:
- Full names in TVET style (SURNAME, First name)
- UVTAB-format admission numbers (`UVT212/U/26/[M|F]/[PROG]/XXXX`)
- Programmes from Greenfield VTI's catalogue (NCES, NCAM, NCBC, NCPL, NCAP)
- Guardian details, district of origin, sponsorship type

---

## Contingency Notes

| If... | Then... |
|---|---|
| Login fails | Check server is running: `pnpm dev` from repo root |
| Import fails | Ensure file is saved as CSV (not XLSX). Headers must match exactly. |
| KTI data not visible | Confirm tenant slug is `kti` — use `admin@tenant-a.test` as fallback |
| Teams screen share lag | Reduce browser zoom to 100%, close other apps |
| Audience asks about mobile app | "Mobile-responsive web — works on tablets and phones in browser" |
| Audience asks about offline sync | "Offline bundle packaging is in the roadmap — architecture supports it" |
