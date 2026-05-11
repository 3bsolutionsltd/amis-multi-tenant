#!/usr/bin/env node
/**
 * Creates all post-demo + data-leakage GitHub issues and adds them to Project #5.
 * Run: node scripts/create-post-demo-issues.js
 */

const TOKEN = process.env.GITHUB_TOKEN || require("fs").readFileSync("C:\\Users\\DELL\\.github-token", "utf8").trim();
const OWNER = "3bsolutionsltd";
const REPO  = "amis-multi-tenant";
const PROJECT_NODE_ID   = "PVT_kwHODNsZL84BUPC_";
const STATUS_FIELD_ID   = "PVTSSF_lAHODNsZL84BUPC_zhBYnDg";
const TODO_OPTION_ID    = "f75ad846"; // "Todo" status value id

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function restPost(url, body) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`REST error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function graphql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  return data.data;
}

async function addToProject(issueNodeId) {
  const d = await graphql(
    `mutation($projectId:ID!,$contentId:ID!){addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){item{id}}}`,
    { projectId: PROJECT_NODE_ID, contentId: issueNodeId }
  );
  return d.addProjectV2ItemById.item.id;
}

async function setStatus(itemId) {
  await graphql(
    `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$value:ProjectV2FieldValue!){updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:$value}){projectV2Item{id}}}`,
    { projectId: PROJECT_NODE_ID, itemId, fieldId: STATUS_FIELD_ID, value: { singleSelectOptionId: TODO_OPTION_ID } }
  );
}

const ISSUES = [
  {
    title: "[SECURITY] Multi-tenant data leakage: API pool connects as PostgreSQL superuser, bypassing RLS",
    labels: ["bug", "security", "critical"],
    body: `## Summary
The API database pool connects using the \`postgres\` superuser role (\`DATABASE_URL=postgres://postgres:...\`). PostgreSQL superusers bypass Row-Level Security (RLS) **even when \`FORCE ROW LEVEL SECURITY\` is set** on the table. This means the RLS policies (e.g. \`students_tenant_isolation\`) are never evaluated — queries return rows from **all tenants**, not just the requesting tenant.

## Impact
- \`GET /students\` returns students from ALL tenants, not just the logged-in user's tenant
- Same applies to admissions, marks, payments, fees, and all other \`app.*\` tables with RLS policies
- Any authenticated user at any VTI can inadvertently see another VTI's data

## Root Cause
\`.env\`:
\`\`\`
DATABASE_URL=postgres://postgres:password123@localhost:5432/amis_multi_tenant
\`\`\`
\`pool.ts\` reads \`DATABASE_URL\`, connecting as the \`postgres\` superuser.

PostgreSQL docs: *"Row security policies are not applied when connected as a superuser."*

A non-superuser role \`amis_app\` exists (created in migration 005) but is not being used by the API pool. \`APP_DATABASE_URL=postgres://amis_app:amis_dev@...\` is defined in \`.env\` but unused by \`pool.ts\`.

## Fix
1. Add a new migration that: (a) grants all current tables + sequences in \`app\` and \`platform\` schemas to \`amis_app\`, (b) sets \`ALTER DEFAULT PRIVILEGES\` so future tables are automatically granted
2. Change \`pool.ts\` to use \`process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL\`
3. Update staging/production env to provide \`APP_DATABASE_URL\` pointing to \`amis_app\` user

## Reproduction
1. Ensure two VTIs (e.g. KTI and St. Simon's) have students seeded
2. Log in to one VTI
3. \`GET /students\` returns students from both VTIs`,
  },
  {
    title: "[SECURITY] clearTokens() does not clear amis_tenant_id from localStorage",
    labels: ["bug", "security"],
    body: `## Summary
\`apps/web/src/lib/auth.ts\` — \`clearTokens()\` removes \`amis_access_token\`, \`amis_refresh_token\`, and \`amis_user\` but does **not** remove \`amis_tenant_id\`.

\`apiFetch.ts\` always reads \`localStorage.getItem("amis_tenant_id")\` and sends it as the \`x-tenant-id\` header. In development mode (devIdentityHook), if no Bearer token is present, this stale tenant ID is used for request context.

## Impact
- After logout, if a user navigates to a page before their new access token is set, devIdentityHook may use the stale tenant context
- Tenant-switching (e.g. platform admin logging in as different VTI) could contaminate the session

## Fix
Add \`localStorage.removeItem("amis_tenant_id")\` to the \`clearTokens()\` function.`,
  },
  {
    title: "[BUG] Setup page redirect fails after successful VTI creation",
    labels: ["bug"],
    body: `## Summary
After completing the 4-step VTI setup wizard (\`/setup\`), the backend creates the tenant and admin user successfully (HTTP 201), but the frontend fails to redirect to \`/admin-studio\`. The user sees an error and the auto-login doesn't complete.

## Observed in Demo (May 8, 2026)
Stephen created "St. Simon's" VTI — confirmed created in platform admin — but the redirect to the admin console failed with an error on screen. He had to log in separately.

## Investigation Needed
- Confirm what error the frontend shows after the successful 201 response
- Check if \`setTokens()\` is called and the navigate to \`/admin-studio\` fails
- Check for CORS or JSON parse issues in the onboarding response

## Expected Behaviour
After successful creation, the new admin is auto-logged in and redirected to \`/admin-studio\` with a success banner showing login URL / slug.`,
  },
  {
    title: "[UX] No credential confirmation screen after VTI setup completes",
    labels: ["enhancement"],
    body: `## Summary
After a VTI successfully registers, the admin has no clear record of their login URL, slug, or credentials. They must know their slug to use the \`/login?org=<slug>\` URL.

## Expected Behaviour
Show a confirmation screen / modal after setup with:
- Login URL: \`https://app.amis.institute/login?org=<slug>\`
- Admin email used
- Reminder to save the password

This prevents the common issue of admins forgetting their slug on first login.`,
  },
  {
    title: "[SECURITY] Disable / restrict public /setup route — VTI creation should require platform admin authorization",
    labels: ["security", "enhancement"],
    body: `## Summary
The \`/setup\` route is currently publicly accessible — anyone who knows the URL can register a new VTI without any authorization. The backend \`POST /onboarding\` endpoint also has no authentication requirement.

## Risk
Open self-registration allows unauthorized VTI creation, wasting resources and creating noise in the platform admin dashboard.

## Proposed Fix
- Restrict \`POST /onboarding\` to require a time-limited setup token issued by the platform admin, OR
- Remove the public \`/setup\` route entirely and redirect to a platform-admin-only provisioning flow (\`/platform-admin/provision\`)
- Show a "Contact your system administrator to get started" page at \`/setup\``,
  },
  {
    title: "[UX] Login flow requires two steps (slug then email/password) — simplify to single step",
    labels: ["enhancement"],
    body: `## Summary
The current login flow requires:
1. Enter institution URL slug (or navigate to \`/login?org=slug\`)
2. Then enter email + password

This is confusing especially for new users who don't know their slug. Demo showed Stephen struggling to remember/enter the correct slug.

## Proposed Flow
Single step: enter email + password. The backend resolves the tenant from the email address (since emails are globally unique within the platform). If a user exists at multiple tenants (edge case), show tenant selector.

## Backend Change Required
\`POST /auth/login\` currently requires \`tenantSlug\`. Change to accept \`email\` + \`password\`, look up the user's tenant from the \`platform.users\` table.`,
  },
  {
    title: "[FEATURE] Email OTP / 2FA — require one-time code after password verification",
    labels: ["enhancement", "security"],
    body: `## Summary
After the user's password is verified, require a 6-digit OTP sent to their registered email before completing login. This provides a second factor of authentication.

## Flow
1. User enters email + password → verified
2. Server generates 6-digit OTP, emails it, returns \`{ status: "otp_required", sessionToken: "..." }\`
3. User enters OTP code
4. Server validates OTP → issues access + refresh tokens

## Implementation Notes
- OTP valid for 10 minutes, single use
- Store hashed OTP + expiry in a new \`platform.otp_tokens\` table
- Use existing email infrastructure (or add transactional email via SMTP / Resend)
- \`sessionToken\` prevents the OTP being bypassed by skipping step 3`,
  },
  {
    title: "[ACCESS] Registrar role cannot access Academic Calendar, Fee Structures, or Grading Scale in Admin Studio",
    labels: ["bug", "access-control"],
    body: `## Summary
\`AdminStudioLayout.tsx\` hard-blocks any role that is not \`admin\` from the entire Admin Studio section. Registrars are redirected away even though the backend APIs grant them full write access to Academic Calendar, Fee Structures, Grading Scale, and Programmes.

## Evidence
\`AdminStudioLayout.tsx\` line 42–47:
\`\`\`ts
if (role !== "admin") {
  return <Navigate to="/dashboard" replace />;
}
\`\`\`

Backend \`WRITE_ROLES\` in \`academic-calendar.routes.ts\`, \`fee-structures.routes.ts\`, \`programmes.routes.ts\`:
\`\`\`ts
const WRITE_ROLES = ["registrar", "admin"];
\`\`\`

## Fix
Change the AdminStudioLayout guard to allow \`["admin", "registrar"]\`. Conditionally hide admin-only sub-sections (Branding, Module Toggles, Nav Editor, Workflow Config, Users & Roles) for registrar.`,
  },
  {
    title: "[UX] New VTI has no onboarding checklist — admin doesn't know what to configure first",
    labels: ["enhancement"],
    body: `## Summary
When a new VTI is created, the admin lands on an empty dashboard with no guidance. There is no checklist or wizard to walk them through essential first-time configuration steps.

## Proposed Onboarding Checklist
After first login, show a dismissible checklist card:
- [ ] Set up Academic Year and Terms (Academic Calendar)
- [ ] Add Programmes / Courses
- [ ] Import or add first student intake
- [ ] Set up Fee Structures
- [ ] Add staff and assign roles
- [ ] Configure grading scale

Progress is tracked per-tenant and persisted. Checklist auto-hides when all steps are complete.`,
  },
  {
    title: "[FEATURE] Pre-load TVET Uganda standard academic calendar on new VTI creation",
    labels: ["enhancement"],
    body: `## Summary
Every new TVET VTI in Uganda follows the same standard academic calendar (defined by UVTAB/MOES): two semesters per year, standardized term dates. Currently new VTIs start with an empty academic calendar and must configure it from scratch.

## Proposed
After VTI creation, optionally seed the academic calendar with a standard TVET Uganda template:
- Academic Year: e.g. 2025/2026
- Semester 1: Feb – Jun
- Semester 2: Aug – Dec
- Standard holidays (Martyrs' Day, Heroes' Day, Christmas, etc.)

The admin can edit/override after seeding. Offer this as a one-click action during the onboarding checklist.`,
  },
];

async function run() {
  for (const issue of ISSUES) {
    try {
      console.log(`Creating: ${issue.title.slice(0, 70)}...`);
      const created = await restPost(
        `https://api.github.com/repos/${OWNER}/${REPO}/issues`,
        { title: issue.title, body: issue.body, labels: issue.labels }
      );
      console.log(`  → #${created.number} ${created.html_url}`);

      const itemId = await addToProject(created.node_id);
      await setStatus(itemId);
      console.log(`  → Added to Project #5 as Todo`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }
  console.log("\nDone.");
}

run();
