# AMIS Multi-Tenant — Comprehensive Project Todo List

> Generated: 2026-04-29 | GitHub Repo: `3bsolutionsltd/amis-multi-tenant`

---

## STATUS KEY
- ✅ Done / implemented
- 🔧 In progress / partially done
- ⏳ Pending (not started)
- 🚫 Blocked

---

## PART 1 — SCHEMA GAPS (Issues #84–#90)

### #84 — Payments have no term_id
- ⏳ Add `term_id uuid` FK to `app.payments` table (migration)
- ⏳ Update `POST /payments` to accept and store `term_id`
- ⏳ Update fee collection report query to filter by term
- ⏳ Add test coverage

### #85 — Term registrations use free-text labels, not FK references
- ⏳ Add `app.terms` and `app.academic_years` as FK references on `app.term_registrations`
- ⏳ Migrate existing text labels (`academic_year`, `term`) to FK `term_id`
- ⏳ Update all routes that read/write term registrations
- ⏳ Update frontend selectors to use IDs, not text strings

### #86 — No auto-computation from mark entries to term results
- ⏳ Create trigger or scheduled job: when all marks entered for a student/unit/term, auto-compute `app.term_results` row
- ⏳ Compute grade using grading scale (`app.grading_scales`)
- ⏳ Consider a `POST /marks/compute-results?term_id=` endpoint for manual trigger
- ⏳ Add tests for computation logic

### #87 — No prerequisite checks before clearance can be initiated or signed
- ✅ Partial: `computeEligibility()` implemented (#95) — checks fees_cleared + marks_complete
- ⏳ Add prerequisite: `term_registration` must exist before clearance can be opened
- ⏳ Add prerequisite: all mark entries must be submitted (not just present)
- ⏳ Wire attendance check (#89) into eligibility once attendance is recorded

### #88 — No formal status column on admission_applications
- ⏳ Add `status` enum column to `app.admission_applications` (e.g. `pending`, `reviewed`, `accepted`, `rejected`, `enrolled`)
- ⏳ Add status transition endpoint (`PATCH /admissions/:id/status`)
- ⏳ Update admission list/detail pages to show and update status
- ⏳ Add tests

### #89 — Attendance data not wired to clearance or exam eligibility
- ⏳ Design `app.attendance` table (student, term, unit, date, present/absent)
- ⏳ Migration for attendance table
- ⏳ API routes: `POST /attendance`, `GET /attendance?student_id=&term_id=`
- ⏳ Compute attendance % per student/term and expose on eligibility endpoint
- ⏳ Wire into clearance eligibility check (minimum 75% attendance threshold configurable)
- ⏳ Frontend attendance recording page

### #90 — No enrolment verification at mark entry
- ⏳ Add guard on `POST /marks` to verify `term_registration` exists for student+term
- ⏳ 422 error if student is not registered for the term being marked
- ⏳ Add tests

---

## PART 2 — UVTAB EIMS FEATURES (Issues #91–#96)

### #91 — UVTAB EIMS CSV Export ✅ IMPLEMENTED
- ✅ Migration `20260429000051_uvtab_student_fields.sql` — adds `assessment_level`, `previous_index` to `app.students`
- ✅ `UvtabExportQuerySchema` in `reports.schema.ts`
- ✅ `GET /reports/uvtab-eims-export?academic_year=&term=` endpoint in `reports.routes.ts`
- ✅ Returns 11-column CSV: center_code, nin, first_name, surname, other_names, gender(M/F), dob, program_code, assessment_level, previous_index, contact_number
- ✅ 422 if `uvtab_centre_code` not set on tenant
- ⏳ **Run migration** `dbmate up` to apply `assessment_level` + `previous_index` columns
- ⏳ Frontend: "Export UVTAB CSV" button on Reports page
- ⏳ Add `assessment_level` + `previous_index` fields to Student create/edit form
- ⏳ NIN validation (14 chars, starts with CM/CF) on student form
- ⏳ Readiness dashboard: flag students with missing/invalid NIN, missing assessment_level, or missing previous_index before export
- ⏳ Write tests for export endpoint

### #92 — Digital IT Logbook with Supervisor Sign-off
- ⏳ Design `app.it_logbook_entries` table (student_id, placement_id, date, activities, hours, supervisor_comment)
- ⏳ Migration for logbook table
- ⏳ API routes: `POST /it-logbooks`, `GET /it-logbooks?placement_id=`, `PATCH /it-logbooks/:id/sign`
- ⏳ Frontend: IT Logbook page (student view + supervisor sign-off view)
- ⏳ PDF export of completed logbook

### #93 — Evidence Attachments on Mark Entries
- ⏳ Design file storage strategy (S3/local/Supabase storage)
- ⏳ Add `attachment_url text` to `app.mark_entries`
- ⏳ API: `POST /marks/:id/attachment` (multipart upload)
- ⏳ Frontend: file upload on mark entry form

### #94 — RLP Student Project Costing (Inventory → Student)
- ⏳ Design `app.student_project_costs` table (student_id, term_id, item_description, qty, unit_cost)
- ⏳ Migration
- ⏳ API routes: CRUD on student project costs
- ⏳ Link to `app.fee_structures` or produce separate invoice
- ⏳ Frontend: project cost sheet page per student

### #95 — Clearance Eligibility Enforcement Layer ✅ IMPLEMENTED
- ✅ `computeEligibility(client, studentId, termId)` helper
- ✅ `GET /clearance/eligibility/:studentId?term_id=` endpoint
- ✅ `POST /clearance/sign-off` with 422 enforcement (accounts: fees_cleared; hod: marks_complete)
- ✅ 11 tests passing
- ✅ Frontend `ClearancePage.tsx` — eligibility checklist card + conditional sign button
- ⏳ Add attendance check (pending #89)
- ⏳ Add enrolment/registration check (pending #90)

### #96 — Student Name Format Standardisation (UVTAB Convention) ✅ IMPLEMENTED
- ✅ `apps/web/src/lib/formatStudentName.ts` — renders `SURNAME Firstname Other_names`
- ✅ 10 frontend files updated: StudentsListPage, StudentDetailPage, StudentPickerInput, TermRegistrationsListPage, TermRegistrationDetailPage, TermRegistrationCreatePage, ResultsPage, TranscriptPage, ResultsSlipPage, FeeCollectionReportPage
- ⏳ Apply same format to any PDF/print outputs (transcripts, result slips, clearance letters)
- ⏳ Apply same format to API response name fields where used in documents

---

## PART 3 — EPICS / LARGER FEATURES

### Epic M — Data Migration (#10)
- ⏳ DS-001: Migrate student roster from KTI legacy system
- ⏳ DS-002–DS-014: Remaining data migration tasks (see issue #10 for full list)
- ⏳ Validate migrated data against UVTAB format (NIN, name format, assessment_level)

### Academic Calendar & Terms
- ✅ `app.academic_years` and `app.terms` tables exist (migration 023)
- ⏳ Frontend: Academic Year management page (create, set active)
- ⏳ Frontend: Terms management page (create terms per academic year)

### Grading & Results
- ✅ `app.grading_scales` table exists
- ✅ `app.term_results` table exists
- ⏳ Frontend: Grading scale configuration page per tenant
- ⏳ Auto-computation of grade from mark entry (links to #86)
- ⏳ Official transcript generation (PDF)
- ⏳ Results slip PDF download

### Fee Management
- ✅ `app.fee_structures` and `app.payments` tables exist
- ✅ Fee Collection Report page
- ⏳ Fee structure configuration UI
- ⏳ Payment recording UI
- ⏳ Balance/arrears summary per student
- ⏳ Receipt generation (PDF)
- ⏳ Link payments to `term_id` (issue #84)

### Notifications (#47 from prior work)
- ✅ `app.notifications` table exists (migration 047)
- ⏳ API routes: `GET /notifications`, `PATCH /notifications/:id/read`
- ⏳ Frontend: notification bell + notification list
- ⏳ Trigger notifications on clearance sign-off, mark submission, fee payment

### IAM / Roles (#48–#49)
- ✅ New roles migration (048) done
- ✅ IAM improvements (049) done
- ⏳ Role assignment UI in tenant admin panel
- ⏳ Audit log for role changes

### Platform Admin
- ✅ `platform_admin_nullable_tenant` migration (050) done
- ⏳ Platform admin dashboard (list tenants, usage stats)
- ⏳ Tenant onboarding flow (create tenant, set uvtab_centre_code, initial admin user)
- ⏳ Tenant settings page (update uvtab_centre_code, logo, institution details)

---

## PART 4 — INFRASTRUCTURE / DEVOPS

- ⏳ Production Docker Compose (`docker-compose.prod.yml`) — test end-to-end
- ⏳ CI/CD pipeline (GitHub Actions): run tests on PR, build Docker image on merge to main
- ⏳ DB backup strategy for production PostgreSQL
- ⏳ Environment variable management (secrets, not committed to repo)
- ⏳ Sentry or equivalent error tracking in API

---

## PART 5 — TESTING GAPS

- ✅ 377+ tests currently passing (Vitest)
- ⏳ Tests for `GET /reports/uvtab-eims-export`
- ⏳ Tests for fee collection report with `term_id` filter (after #84)
- ⏳ Tests for mark entry enrolment guard (after #90)
- ⏳ Tests for auto-computation of term results (after #86)
- ⏳ Integration test: full student lifecycle (admit → register → mark → clear → export UVTAB CSV)

---

## IMMEDIATE NEXT ACTIONS (priority order)

1. **`dbmate up`** — apply migration 051 (`assessment_level` + `previous_index` on `app.students`)
2. **Frontend: Export UVTAB CSV button** — add to Reports page (`/reports` or new `/reports/uvtab-eims`)
3. **Student form: add `assessment_level` + `previous_index` fields** — StudentCreatePage / StudentDetailPage edit mode
4. **Issue #88** — add status column to admission_applications
5. **Issue #86** — auto-compute term results from mark entries
6. **Issue #85** — replace free-text term labels with FK references
7. **Issue #84** — add `term_id` to payments
8. **Issue #89** — attendance recording and eligibility hook
9. **Issue #90** — enrolment guard on mark entry
10. **Epic M (#10)** — data migration from KTI legacy system
