const https = require('https');
const fs = require('fs');

const token = (process.env.GH_TOKEN || fs.readFileSync('C:\\Users\\DELL\\.github-token', 'utf8')).trim();
const OWNER = '3bsolutionsltd';
const REPO = 'amis-multi-tenant';
const PROJECT_ID = 'PVT_kwHODNsZL84BUPC_';

const ISSUES = [
  {
    title: '[Gap] Payments have no term_id',
    labels: ['data-model', 'P1-high'],
    body: `## Problem
\`app.payments\` has no \`term_id\` column. It is impossible to reconcile "how much did a student pay for Term X" from the payments table alone.

## Impact
- Fee clearance cannot accurately confirm a student has cleared fees **for a specific term**
- The finance overview cannot break down revenue by term
- SchoolPay reconciliation cannot be mapped to a term context

## Suggested Fix
Add a nullable \`term_id UUID REFERENCES app.terms(id)\` column to \`app.payments\`. Update the payment recording UI and CSV import to capture term context. Backfill or leave NULL for historical records.`,
  },
  {
    title: '[Gap] Term registrations use free-text labels, not FK references',
    labels: ['data-model', 'P1-high'],
    body: `## Problem
\`app.term_registrations.academic_year\` and \`.term\` are stored as plain \`TEXT\` fields (e.g. "2025/2026", "Term 1"). There is no foreign key to \`app.academic_years\` or \`app.terms\`.

## Impact
- Typos in the UI silently create orphaned registrations with no matching calendar entry
- Queries joining registrations to actual term records require fragile string matching
- Changing a term's name breaks historical lookups

## Suggested Fix
Replace the text columns with \`academic_year_id UUID REFERENCES app.academic_years(id)\` and \`term_id UUID REFERENCES app.terms(id)\`. Update the BulkRegistration API to accept UUIDs and migrate existing text data.`,
  },
  {
    title: '[Gap] No auto-computation from mark entries to term results',
    labels: ['backend', 'P1-high'],
    body: `## Problem
\`app.term_results\` and \`app.term_gpa\` tables exist but are **never populated automatically**. Mark entries land in \`app.mark_entries\` but nothing aggregates them into final results.

## Impact
- Results page always shows empty data unless manually populated via raw SQL
- GPA/rank computations are entirely absent from the system
- Staff cannot view student performance summaries at end of term

## Suggested Fix
Implement a results computation service/endpoint (e.g. \`POST /terms/:id/compute-results\`) that:
1. Aggregates mark entries per student per course
2. Applies grading scales from \`app.grading_scales\`
3. Writes rows into \`app.term_results\` and \`app.term_gpa\`

Trigger it explicitly (HOD/Dean action) or as an async job after mark submission deadline.`,
  },
  {
    title: '[Gap] No prerequisite checks before clearance can be initiated or signed',
    labels: ['backend', 'workflow', 'P1-high'],
    body: `## Problem
A student can be cleared (all 8 departments sign off) even if:
- Fees are outstanding
- Mark entries are missing for their enrolled courses
- Attendance falls below the required threshold

There is no enforcement layer between modules.

## Impact
- Students can graduate without settling balances
- Academic integrity is compromised if clearance is granted without complete marks
- The clearance workflow is a rubber stamp rather than a genuine gate

## Suggested Fix
Before each department clearance step (or before initiating clearance), validate:
1. **Finance:** \`payments\` total >= fee structure total for the term
2. **Academics/HOD:** all expected mark entries exist and are submitted
3. **Attendance:** attendance rate >= configured minimum %

Expose a \`GET /students/:id/clearance-eligibility?term_id=\` endpoint that returns a checklist. Block the sign-off UI if any prerequisite fails.`,
  },
  {
    title: '[Gap] No formal status column on admission_applications',
    labels: ['data-model', 'backend', 'P2-medium'],
    body: `## Problem
The admission application's state (submitted, under review, accepted, rejected, enrolled) lives **only** in the workflow engine's \`current_state\` field. There is no denormalised \`status\` column directly on \`app.admission_applications\`.

## Impact
- If the workflow config is missing or misconfigured, applications appear stuck with no visible status
- Filtering applications by status requires a JOIN through the workflow engine tables
- Reporting on conversion rates (applied → enrolled) is unnecessarily complex

## Suggested Fix
Add a \`status TEXT NOT NULL DEFAULT 'draft'\` column to \`app.admission_applications\` with a CHECK constraint on known values. Keep it in sync with the workflow engine via a trigger or explicit update in the workflow transition handler.`,
  },
  {
    title: '[Gap] Attendance data not wired to clearance or exam eligibility',
    labels: ['backend', 'workflow', 'P2-medium'],
    body: `## Problem
\`app.attendance\` records daily/session attendance but this data is **never checked** when:
- Determining a student's clearance eligibility
- Deciding whether a student may sit for exams

## Impact
- A student with 10% attendance can be cleared and sit exams the same as one with 100%
- Attendance recording becomes a data collection exercise with no downstream effect

## Suggested Fix
1. Add a configurable \`min_attendance_percent\` setting (per tenant or per programme) in the config/versions system
2. Integrate an attendance check into the clearance eligibility endpoint (see Gap #4)
3. Optionally surface an "exam barred" flag on the student profile when below threshold`,
  },
  {
    title: '[Gap] No enrolment verification at mark entry',
    labels: ['backend', 'P2-medium'],
    body: `## Problem
Marks can be submitted for any student + course + term combination via \`app.mark_entries\` **even if the student was never registered** for that term in \`app.term_registrations\`.

## Impact
- Ghost mark entries for students who dropped, deferred, or were never enrolled
- Results computation (when implemented) will include unregistered students
- Audit trail is polluted with invalid entries

## Suggested Fix
Add a server-side validation in the mark entry submission endpoint:
\`\`\`sql
SELECT 1 FROM app.term_registrations
WHERE student_id = $1 AND term_id = $2
\`\`\`
Return HTTP 422 with a descriptive error if no registration record exists. Consider a DB constraint or trigger as a belt-and-suspenders measure.`,
  },
];

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => (b += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          reject(new Error(`Parse error: ${b}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createIssue(issue) {
  const body = JSON.stringify({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });
  const { status, data } = await request(
    {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/issues`,
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'AMIS',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
  if (status !== 201) throw new Error(`HTTP ${status}: ${JSON.stringify(data)}`);
  return data;
}

async function addIssueToProject(nodeId) {
  const mutation = `mutation {
    addProjectV2ItemById(input: {
      projectId: "${PROJECT_ID}"
      contentId: "${nodeId}"
    }) {
      item { id }
    }
  }`;
  const body = JSON.stringify({ query: mutation });
  const { status, data } = await request(
    {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'AMIS',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
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
