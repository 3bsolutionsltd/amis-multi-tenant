/**
 * Creates QA bug/gap issues from the login functionality QA report
 * and adds them to GitHub Project #5 "AMIS Build Tracker".
 */
const https = require("https");
const fs = require("fs");

const TOKEN = fs.readFileSync("C:/Users/DELL/.github-token", "utf8").trim();
const OWNER = "3bsolutionsltd";
const REPO = "amis-multi-tenant";
const PROJECT_NODE = "PVT_kwHODNsZL84BUPC_";
const STATUS_FIELD = "PVTSSF_lAHODNsZL84BUPC_zhBYnDg";
const TODO_OPTION = "f75ad846";

function ghRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "api.github.com",
        headers: {
          Authorization: "Bearer " + TOKEN,
          "User-Agent": "amis-qa-script",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
        ...opts,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function graphql(query, variables) {
  const body = { query, variables };
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path: "/graphql",
        method: "POST",
        headers: {
          Authorization: "Bearer " + TOKEN,
          "User-Agent": "amis-qa-script",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function createIssue(title, body, labels) {
  const res = await ghRequest(
    { path: `/repos/${OWNER}/${REPO}/issues`, method: "POST" },
    { title, body, labels }
  );
  if (res.status !== 201) throw new Error(`Failed to create issue "${title}": ${JSON.stringify(res.body)}`);
  return { number: res.body.number, nodeId: res.body.node_id };
}

async function addToProject(issueNodeId) {
  const result = await graphql(
    `mutation AddItem($project: ID!, $content: ID!) {
       addProjectV2ItemById(input: { projectId: $project, contentId: $content }) {
         item { id }
       }
     }`,
    { project: PROJECT_NODE, content: issueNodeId }
  );
  if (result.errors) throw new Error("addToProject error: " + JSON.stringify(result.errors));
  return result.data.addProjectV2ItemById.item.id;
}

async function setStatus(itemId) {
  const result = await graphql(
    `mutation SetStatus($project: ID!, $item: ID!, $field: ID!, $value: String!) {
       updateProjectV2ItemFieldValue(input: {
         projectId: $project, itemId: $item,
         fieldId: $field,
         value: { singleSelectOptionId: $value }
       }) { projectV2Item { id } }
     }`,
    { project: PROJECT_NODE, item: itemId, field: STATUS_FIELD, value: TODO_OPTION }
  );
  if (result.errors) throw new Error("setStatus error: " + JSON.stringify(result.errors));
}

const ISSUES = [
  {
    title: "[BUG-001] GET /auth/me does not enforce is_active check",
    labels: ["bug", "auth", "security"],
    body: `## Summary

\`GET /auth/me\` fetches \`is_active\` from the database but never validates it before returning \`200 OK\`. A deactivated user holding a valid, unexpired JWT can call this endpoint and receive their profile data — including \`isActive: false\`.

This is inconsistent with the \`requireAuth\` middleware, which correctly returns \`401\` for deactivated users.

## Severity
**High**

## Location
\`apps/api/src/modules/auth/auth.routes.ts\` — \`GET /auth/me\` handler

## Steps to Reproduce
1. Obtain a valid JWT for an active user.
2. Set \`is_active = false\` for that user in the database.
3. Call \`GET /auth/me\` with the Bearer token.
4. Observe: \`200 OK\` is returned with the user's data.

## Expected
\`401 Unauthorized\` — \`{"message":"Invalid or expired token"}\`

## Actual
\`200 OK\` with \`{"isActive": false, ...}\`

## Recommended Fix
Add an \`is_active\` check after the DB lookup, mirroring the \`requireAuth\` middleware:

\`\`\`ts
if (!user || !user.is_active) {
  return reply.status(401).send({ statusCode: 401, message: "Invalid or expired token" });
}
\`\`\``,
  },
  {
    title: "[BUG-002] Missing test: inactive user on GET /auth/me",
    labels: ["bug", "auth", "testing"],
    body: `## Summary

The \`GET /auth/me\` test suite does not cover the case of a deactivated user with a valid JWT. This gap allowed BUG-001 to go undetected.

## Severity
**Medium**

## Location
\`apps/api/src/tests/auth/auth.test.ts\` — \`GET /auth/me\` describe block

## Details
The \`inactive@auth-test.local\` fixture user is already created in \`beforeAll\` and is available for this test. The test needs to:
1. Obtain a valid JWT for the inactive user via \`jwt.sign\` directly.
2. Call \`GET /auth/me\` with that token.
3. Assert \`401\` is returned.

## Related
Tracks BUG-001.`,
  },
  {
    title: "[GAP-001] No rate limit on POST /auth/refresh",
    labels: ["security", "auth", "enhancement"],
    body: `## Summary

\`POST /auth/refresh\` has no rate limit, unlike all other sensitive auth endpoints.

## Severity
**Medium**

## Location
\`apps/api/src/modules/auth/auth.routes.ts\` — \`POST /auth/refresh\` handler

## Details
The following endpoints all have rate limits configured:
- \`POST /auth/login\` — 10 req/min
- \`POST /auth/platform-login\` — 10 req/min
- \`POST /auth/forgot-password\` — 5 req/min
- \`POST /auth/reset-password\` — 5 req/min

\`POST /auth/refresh\` has no such protection. An attacker with a valid refresh token could make unlimited calls, exhausting DB connection pool resources.

## Recommended Fix
\`\`\`ts
app.post("/auth/refresh", {
  config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
}, async (req, reply) => {
\`\`\``,
  },
  {
    title: "[GAP-002] JWT verifyToken does not restrict allowed algorithms",
    labels: ["security", "auth", "enhancement"],
    body: `## Summary

\`verifyToken\` calls \`jwt.verify(token, secret)\` without specifying an \`algorithms\` option, relying implicitly on the library default.

## Severity
**Medium**

## Location
\`apps/api/src/lib/jwt.ts\` — \`verifyToken\` function

## Details
OWASP JWT Security Cheat Sheet (item 1) recommends explicitly specifying allowed algorithms. While \`jsonwebtoken\` v9+ rejects \`alg: none\` by default:
- A future library version change could silently expand accepted algorithms.
- Security audits cannot verify intent from the source code alone.

## Recommended Fix
\`\`\`ts
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}
\`\`\``,
  },
  {
    title: "[GAP-003] Login error messages leak account existence and password correctness",
    labels: ["security", "auth"],
    body: `## Summary

\`POST /auth/login\` and \`POST /auth/platform-login\` return a distinct \`"Account disabled"\` error when the password is correct but the account is inactive. This reveals that the account exists and the submitted password was correct.

## Severity
**Low**

## Location
\`apps/api/src/modules/auth/auth.routes.ts\` — login handlers

## Details
Current behaviour:
- Wrong password or unknown email → \`401 "Invalid credentials"\`
- Correct password, inactive account → \`401 "Account disabled"\`

The distinction confirms to an attacker that:
1. The email is registered for this tenant.
2. The submitted password is correct.

This is currently reflected intentionally in the test suite.

## Recommended Fix
Return a uniform \`"Invalid credentials"\` message for all login failures regardless of account state. If the product requires communicating account status to users, do so via a separate authenticated channel — not the login response body.`,
  },
];

(async () => {
  for (const issue of ISSUES) {
    process.stdout.write(`Creating: ${issue.title} ... `);
    const { number, nodeId } = await createIssue(issue.title, issue.body, issue.labels);
    console.log(`#${number}`);

    process.stdout.write(`  Adding to project ... `);
    const itemId = await addToProject(nodeId);
    console.log(`item ${itemId}`);

    process.stdout.write(`  Setting status to Todo ... `);
    await setStatus(itemId);
    console.log("done");
  }
  console.log("\nAll issues created and added to the project tracker.");
})();
