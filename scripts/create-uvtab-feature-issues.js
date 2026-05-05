const https = require('https');
const fs = require('fs');

const token = (process.env.GH_TOKEN || fs.readFileSync('C:\\Users\\DELL\\.github-token', 'utf8')).trim();
const OWNER = '3bsolutionsltd';
const REPO = 'amis-multi-tenant';
const PROJECT_ID = 'PVT_kwHODNsZL84BUPC_';

const ISSUES = [
  // ─── P0 ───────────────────────────────────────────────────────────────────
  {
    title: '[Feature] UVTAB EIMS CSV Export',
    labels: ['enhancement', 'reporting', 'P0-blocker'],
    body: `## Summary
Add a one-click UVTAB EIMS exam-registration CSV export to the Reports module.
Turns 3 weeks of manual portal data entry into a 5-second download per exam season.

## Context
UVTAB's Electronic Integrated Management System (EIMS) requires registrars to submit student data in a specific CSV format (NIN, DoB, Programme Code, Centre Code, etc.) before each exam registration window. Currently this is done by manually re-typing from the internal system into the portal.

All the required data **already exists** in the database:
- \`app.students\`: \`nin\`, \`date_of_birth\`, \`first_name\`, \`last_name\`, \`other_names\`, \`gender\`, \`registration_number\`, \`programme_code\`, \`district_of_origin\`
- \`platform.tenants\`: \`uvtab_code\` (centre code)
- \`app.term_registrations\`: links students to a specific term

## Tasks
- [ ] **Confirm** exact UVTAB EIMS CSV column order with the VTI registrar (get template file)
- [ ] **API:** \`GET /reports/uvtab-eims-export?academic_year_id=&term_id=\` → returns \`text/csv\` with headers: \`NIN, SURNAME, OTHER_NAMES, DOB, GENDER, CENTRE_CODE, PROGRAMME_CODE, REG_NUMBER, DISTRICT\`
- [ ] **API:** Handle students with missing NIN — either skip with warning count or include with empty field (per UVTAB rules)
- [ ] **Admin Studio:** Make \`uvtab_code\` a required field in the Institute Profile form with visible validation warning if blank
- [ ] **Frontend:** "UVTAB EIMS Export" button on the NCHE Enrollment report page (or dedicated page) — uses \`window.location\` to trigger file download
- [ ] **Frontend:** Warning banner if \`uvtab_code\` is not set on the tenant

## Acceptance Criteria
- Registrar can select an academic year + term, click "Export", and download a valid EIMS CSV
- Export is rejected with a clear error if the tenant's UVTAB Centre Code is not configured
- File downloads correctly in both Chrome and Edge

## Blocker
Requires the actual UVTAB EIMS CSV column template from the registrar before implementation.`,
  },

  // ─── P1 ───────────────────────────────────────────────────────────────────
  {
    title: '[Feature] Digital IT Logbook with Supervisor Sign-off',
    labels: ['enhancement', 'backend', 'frontend', 'P1-high'],
    body: `## Summary
Extend the Industrial Training module with a digital daily logbook so students record what they did each day, and site supervisors can verify entries with a PIN — eliminating "Ghost IT" fraud.

## Context
UVTAB is cracking down on students who are registered for Industrial Training but never attend the placement site. Currently \`app.industrial_training\` only has a single header row per placement (company, dates, status). There is no record of day-to-day activity.

## Architecture
- New table \`app.it_log_entries\` for daily entries
- Supervisor verification via a bcrypt-hashed 4-digit PIN stored on the IT assignment record
- Ghost detection report: assignments with 0 logs or < 50% supervisor-verified entries

## Tasks

### Database
- [ ] Migration: create \`app.it_log_entries\` table:
  \`\`\`
  id, tenant_id, it_assignment_id FK, student_id,
  log_date date, task_description text, learning_points text,
  supervisor_verified bool DEFAULT false,
  verified_at timestamptz, verified_by_name text,
  verification_method text CHECK('pin','signature','manual'),
  created_at, updated_at
  \`\`\`
- [ ] Migration: \`ADD COLUMN supervisor_pin_hash text\` to \`app.industrial_training\`
- [ ] RLS policy on \`app.it_log_entries\`

### API
- [ ] \`POST /industrial-training/:id/supervisor-pin\` — hashes and stores supervisor PIN
- [ ] \`GET /industrial-training/:id/logs\` — list log entries for an assignment
- [ ] \`POST /industrial-training/:id/logs\` — student creates a daily log entry
- [ ] \`PATCH /industrial-training/logs/:logId\` — student edits an unverified entry
- [ ] \`POST /industrial-training/logs/:logId/verify\` — accepts \`{pin}\`, bcrypt compare, marks entry verified
- [ ] \`GET /reports/it-ghost-detection?term_id=\` — returns assignments with 0 logs or < 50% verification rate
- [ ] Add \`bcrypt\` (or \`@node-rs/bcrypt\`) to \`apps/api/package.json\`

### Frontend
- [ ] \`ITLogbookPage.tsx\` — daily entry form (date, tasks done, learning points); shows existing entries in reverse-chronological order
- [ ] Inline supervisor verification modal — student hands phone to supervisor who enters PIN
- [ ] Logbook summary stats on \`IndustrialTrainingDetailPage\` (days logged, % verified)
- [ ] Route: \`/industrial-training/:id/logbook\`
- [ ] Ghost Detection report page (or section on IT Reports)

## Acceptance Criteria
- Student can submit a daily log entry from a mobile browser
- Supervisor can verify using PIN without needing an account
- Ghost detection report flags all unverified/empty-log assignments
- All log data is tenant-isolated via RLS`,
  },

  // ─── P2 ───────────────────────────────────────────────────────────────────
  {
    title: '[Feature] Evidence Attachments on Mark Entries',
    labels: ['enhancement', 'backend', 'frontend', 'P2-medium'],
    body: `## Summary
Allow instructors to attach photo/PDF evidence (e.g. student task sheet, photo of welded joint) when entering practical marks. Enables an "Evidence Portfolio Report" for UVTAB audits.

## Context
UVTAB's 2026 shift to **Verifiable Evidence** means assessors expect to see the actual student work, not just a number. During audits, instructors must justify internal marks. Currently \`app.mark_entries\` stores scores only.

## Architecture
- Store evidence as a JSONB array of URL objects on \`app.mark_entries\` — no binary storage in the API DB
- For dev/pilot: files uploaded to Fastify static file server (\`/uploads\` directory)
- For production: swap upload endpoint to write to object storage (S3/MinIO), same URL pattern
- Dependencies to add: \`@fastify/multipart\`, \`@fastify/static\`

## Tasks

### Database
- [ ] Migration: \`ADD COLUMN evidence_files jsonb NOT NULL DEFAULT '[]'\` on \`app.mark_entries\`

### API
- [ ] Add \`@fastify/multipart\` and \`@fastify/static\` to \`apps/api/package.json\`
- [ ] \`POST /uploads\` — accepts multipart file, saves to \`./uploads/\` directory, returns \`{url, name, type}\`
- [ ] Register Fastify static plugin to serve \`/uploads\` directory
- [ ] \`PATCH /marks/entries/:id/evidence\` — accepts \`{files:[{url,name,type}]}\`, merges into evidence_files JSONB array
- [ ] \`DELETE /marks/entries/:id/evidence\` — accepts \`{url}\`, removes one entry from array
- [ ] \`GET /reports/evidence-portfolio?student_id=&term_id=\` — returns all mark entries with non-empty evidence for a student, grouped by course

### Frontend
- [ ] Evidence upload section on \`MarkDetailPage\` — file picker, preview thumbnails, upload → submit URL
- [ ] Show evidence count badge on marks list
- [ ] \`EvidencePortfolioPage.tsx\` — printable evidence summary per student/term
- [ ] Route: \`/marks/:id/evidence\` and \`/reports/evidence-portfolio\`

## Acceptance Criteria
- Instructor can upload 1–5 files per mark entry
- Uploaded files persist and are viewable by HOD/admin
- Evidence Portfolio Report lists all evidence per student per term, printable as PDF`,
  },

  // ─── P3 ───────────────────────────────────────────────────────────────────
  {
    title: '[Feature] RLP Student Project Costing (Inventory → Student)',
    labels: ['enhancement', 'backend', 'frontend', 'P2-medium'],
    body: `## Summary
Link Inventory issuances to student Real-Life Projects (RLPs), creating an automated "Project Costing Report" that proves to UVTAB the student managed real resources as part of their assessment.

## Context
UVTAB requires evidence of the full "Project Lifecycle" — from materials requisition to final product. VTIs struggle to track the cost vs. output of RLPs (building a wall, sewing a suit, baking bread). Currently \`app.store_issuances\` records \`issued_to\` as free text with no student or project linkage.

## Architecture
- New lightweight \`app.student_projects\` table as the anchor entity
- Nullable \`student_project_id\` FK added to \`app.store_issuances\`
- Costing view joins issuances → items → unit_cost for automatic cost aggregation
- No changes to procurement flow

## Tasks

### Database
- [ ] Migration: create \`app.student_projects\`:
  \`\`\`
  id, tenant_id, student_id FK, term_id FK, course_id FK (nullable),
  project_title text NOT NULL, description text,
  status text CHECK('draft','active','submitted','assessed') DEFAULT 'draft',
  mark_entry_id uuid FK nullable (links to final assessment mark),
  created_by, created_at, updated_at
  \`\`\`
- [ ] Migration: \`ADD COLUMN student_project_id uuid REFERENCES app.student_projects(id)\` on \`app.store_issuances\`
- [ ] RLS policy on \`app.student_projects\`

### API
- [ ] \`GET /student-projects\` — list with filters (student_id, term_id, status)
- [ ] \`POST /student-projects\` — create project
- [ ] \`GET /student-projects/:id\` — detail + linked issuances
- [ ] \`PATCH /student-projects/:id\` — update status/details
- [ ] \`GET /student-projects/:id/costing\` — returns itemised cost breakdown + total:
  \`{item_name, unit, qty, unit_cost, line_total}[]\` + \`grand_total\`
- [ ] \`PATCH /inventory/issuances/:id\` — allow setting \`student_project_id\`

### Frontend
- [ ] "Projects" tab on \`StudentDetailPage\` — list projects, create new, show cost
- [ ] \`ProjectDetailPage.tsx\` — project info + linked issuances + cost breakdown
- [ ] Issuance create form — optional "Link to RLP Project" dropdown (student's active projects for the current term)
- [ ] Printable project costing report
- [ ] Routes: \`/student-projects/:id\`, \`/student-projects/:id/costing\`

## Acceptance Criteria
- Instructor/stores officer can link an issuance to a student project at time of issue or retroactively
- Project Costing Report shows itemised material cost and can be printed
- Project can be linked to a mark entry for full lifecycle traceability`,
  },

  // ─── Clearance enforcement ─────────────────────────────────────────────────
  {
    title: '[Feature] Clearance Eligibility Enforcement Layer',
    labels: ['enhancement', 'backend', 'frontend', 'workflow', 'P1-high'],
    body: `## Summary
Implement a \`/students/:id/clearance-eligibility\` checklist endpoint that enforces prerequisite checks before clearance sign-offs. Prevents Finance clearing unpaid students and HODs clearing students with missing marks.

## Context
Currently \`POST /clearance/sign-off\` performs no prerequisite validation — any authorised user can sign any department at any time regardless of fee or marks status. This is Gap #87.

The fix is a single **eligibility endpoint** consumed by both the clearance UI and the marks submission flow.

## Architecture
\`\`\`
GET /students/:id/clearance-eligibility?term_id=
→ {
    student_id, term_id,
    registered:      { pass: bool, message: string },
    fees_cleared:    { pass: bool, paid: number, expected: number, balance: number },
    marks_complete:  { pass: bool, submitted: number, expected: number, missing: string[] },
    attendance_ok:   { pass: bool, rate: number, minimum: number },  // once attendance is wired
    overall_eligible: bool
  }
\`\`\`

## Tasks

### API
- [ ] \`GET /students/:id/clearance-eligibility?term_id=\` endpoint:
  - **Registration check:** student has a record in \`app.term_registrations\` for this term
  - **Fee check:** SUM of payments for student ≥ fee structure total for their programme/term (uses \`app.payments\` + \`app.fee_structures\`). Note: this will be imprecise until Gap #84 (term_id on payments) is resolved — use total-to-date as approximation
  - **Marks check:** all \`app.mark_submissions\` for the student's enrolled courses in this term are in \`PUBLISHED\` state
  - Returns structured checklist object
- [ ] \`POST /clearance/sign-off\` — add eligibility pre-check:
  - **FINANCE** department sign-off: block with HTTP 422 if \`fees_cleared.pass = false\`
  - **HOD** department sign-off: block with HTTP 422 if \`marks_complete.pass = false\`
  - Other departments: no hard block (soft warning only)
- [ ] Mark entries \`PUT /marks/entries\` — add soft check: warn (but don't block) if student not registered for the term

### Frontend
- [ ] \`ClearancePage.tsx\` — fetch and display eligibility checklist before showing sign-off buttons
- [ ] Show ✅/❌ per prerequisite; block Finance/HOD sign-off buttons if their prerequisite fails
- [ ] Show balance and missing marks details in the checklist UI
- [ ] "Refresh eligibility" button

## Acceptance Criteria
- Finance cannot sign off a student with outstanding balance (API returns 422)
- HOD cannot sign off a student with unpublished/missing mark submissions (API returns 422)
- Eligibility checklist is visible to the logged-in user before they attempt a sign-off
- A fully paid, fully marked student can be cleared by all departments without obstruction`,
  },
];

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch (e) { reject(new Error(`Parse error: ${b}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createIssue(issue) {
  const body = JSON.stringify({ title: issue.title, body: issue.body, labels: issue.labels });
  const { status, data } = await request({
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/issues`,
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'AMIS',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (status !== 201) throw new Error(`HTTP ${status}: ${JSON.stringify(data)}`);
  return data;
}

async function addIssueToProject(nodeId) {
  const mutation = `mutation {
    addProjectV2ItemById(input: {
      projectId: "${PROJECT_ID}"
      contentId: "${nodeId}"
    }) { item { id } }
  }`;
  const body = JSON.stringify({ query: mutation });
  const { status, data } = await request({
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'User-Agent': 'AMIS',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(data)}`);
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data.addProjectV2ItemById.item.id;
}

(async () => {
  for (const issue of ISSUES) {
    try {
      const created = await createIssue(issue);
      console.log(`✓ Created #${created.number}: ${created.title}`);
      const itemId = await addIssueToProject(created.node_id);
      console.log(`  → Added to project board (item: ${itemId})`);
    } catch (e) {
      console.error(`✗ Failed for "${issue.title}": ${e.message}`);
    }
  }
})();
