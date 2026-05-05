/**
 * Creates all Offline-First & Sync Track issues in GitHub
 * and adds them to the AMIS Build Tracker project (#5).
 *
 * Usage:  GH_TOKEN=<pat>  node scripts/create-offline-sync-issues.js
 */
const https = require('https');

const TOKEN = process.env.GH_TOKEN;
const OWNER = '3bsolutionsltd';
const REPO = 'amis-multi-tenant';
const PROJECT_ID = 'PVT_kwHODNsZL84BUPC_';
const STATUS_FIELD_ID = 'PVTSSF_lAHODNsZL84BUPC_zhBYnDg';
const TODO_OPTION_ID = 'f75ad846';

// ─── Issue definitions ────────────────────────────────────────────────────────

const ISSUES = [
  // ── Track B – Deployment ──────────────────────────────────────────────────
  {
    title: '[Track B] Prompt 24 — Offline Docker Compose production build (UTC Kyema on-prem)',
    labels: ['deployment', 'offline'],
    body: `## Goal
Ship a fully self-contained Docker Compose stack that runs on the UTC Kyema local server with **zero internet connectivity required at runtime**.

## Acceptance Criteria
- [ ] All images pre-built and tagged (api, web/nginx, postgres) — no \`docker pull\` at runtime
- [ ] \`docker-compose.prod.yml\` with pinned image tags, healthchecks, restart policies, and volume mounts
- [ ] \`.env.prod.example\` template covering all required vars (DB_URL, JWT_SECRET, TENANT_SLUG, etc.)
- [ ] \`db/migrations/\` auto-run on \`api\` container startup via \`dbmate up\`
- [ ] Deployment runbook (\`DEPLOY.md\` section: UTC Kyema on-prem) for ICT admin (non-developer audience)
- [ ] \`docker compose -f docker-compose.prod.yml up -d\` brings full system online in < 2 min on LAN

## Technical Notes
- Stack: PostgreSQL 16, Fastify API, React/nginx Web
- Seed script must be runnable as a one-time init step post-deploy
- nginx must serve the React build statically (no Vite dev server in prod)
- Confirm healthcheck endpoint: \`GET /health\` on API

## Linked Prompts
Prompt 24 — Track B Deployment`,
  },

  // ── Track C – Data Migration ──────────────────────────────────────────────
  {
    title: '[Track C] Prompt 25 — Audit UTC Kyema source data (Excel/CSV analysis)',
    labels: ['data-migration'],
    body: `## Goal
Analyse the raw Excel/CSV exports from UTC Kyema and produce a mapping report before any migration scripts are written.

## Acceptance Criteria
- [ ] All source files catalogued: sheet names, column headers, row counts, date ranges
- [ ] Each source column mapped to its AMIS target field (or flagged as unmapped)
- [ ] Data quality issues documented: nulls, duplicate IDs, date format inconsistencies, encoding problems
- [ ] Gap report: fields required by AMIS schema that are absent from source data
- [ ] Output: \`db/data-migration/kti/00-audit-report.md\` (or UTC Kyema equivalent path)

## Source Data Expected (per institution agreement)
- Student register (names, DOBs, programme, sponsor type, year of study)
- Fee payment records (student ref, amount, date, term)
- Mark sheets (student ref, subject, scores, term)
- Admission records (application status, intake year)

## Linked Prompts
Prompt 25 — Track C Data Migration`,
  },
  {
    title: '[Track C] Prompt 26 — UTC Kyema migration scripts (CSV → AMIS schema)',
    labels: ['data-migration'],
    body: `## Goal
Write Node.js/TypeScript migration scripts that transform UTC Kyema source data into AMIS-compatible rows and insert them via the API or direct DB.

## Acceptance Criteria
- [ ] \`db/data-migration/kti/migrate-students.ts\` — maps student rows, deduplicates by name+DOB, assigns UUIDs
- [ ] \`db/data-migration/kti/migrate-fees.ts\` — maps payment records, links to student UUIDs
- [ ] \`db/data-migration/kti/migrate-marks.ts\` — maps mark sheets, links to students + programmes
- [ ] \`db/data-migration/kti/migrate-admissions.ts\` — maps admission records to \`app.admission_applications\`
- [ ] All scripts validate output rows against Zod schemas before insert
- [ ] Duplicate detection: log skipped rows, do not hard-fail on duplicates
- [ ] Scripts are idempotent (safe to re-run)
- [ ] \`db/data-migration/kti/README.md\` with run order and instructions

## Technical Notes
- Use \`withTenant()\` pattern for all DB writes
- Tenant slug for UTC Kyema: to be confirmed (e.g. \`utc-kyema\`)
- Run as: \`tsx db/data-migration/kti/migrate-students.ts\`

## Linked Prompts
Prompt 26 — Track C Data Migration`,
  },
  {
    title: '[Track C] Prompt 27 — UTC Kyema dry-run migration + validation report',
    labels: ['data-migration'],
    body: `## Goal
Execute all migration scripts against a **staging database clone** and produce a validation report before touching production.

## Acceptance Criteria
- [ ] Staging DB clone created (local or Supabase branch)
- [ ] All 4 migration scripts run in order without fatal errors
- [ ] Validation report generated: rows inserted vs skipped vs errored per module
- [ ] Row counts cross-checked against source Excel totals
- [ ] At least 10 spot-check records manually verified (student, marks, fee, admission)
- [ ] Any warnings or data anomalies documented for manual review by UTC Kyema registrar
- [ ] Output: \`db/data-migration/kti/dry-run-report.md\`

## Rollback
Staging DB is disposable — drop and recreate if needed.

## Linked Prompts
Prompt 27 — Track C Data Migration`,
  },
  {
    title: '[Track C] Prompt 28 — UTC Kyema production migration + post-migration verification',
    labels: ['data-migration'],
    body: `## Goal
Execute the validated migration scripts on the live production database and confirm system integrity.

## Acceptance Criteria
- [ ] Production DB backup taken immediately before migration
- [ ] Migration scripts run in correct order on production
- [ ] Post-migration verification checklist completed:
  - [ ] Student count matches expected total
  - [ ] Fee records linked correctly to students
  - [ ] Marks visible in MarksListPage for correct term/student combinations
  - [ ] Admission applications in correct workflow states
- [ ] UTC Kyema registrar signs off on 3 spot-check student records
- [ ] Rollback procedure documented and tested (restore from backup)
- [ ] Output: \`db/data-migration/kti/production-migration-log.md\`

## Rollback Plan
Restore from pre-migration backup. Migration scripts are idempotent — no partial state issues.

## Linked Prompts
Prompt 28 — Track C Data Migration`,
  },

  // ── Offline Sync v1 (post-pilot backlog) ──────────────────────────────────
  {
    title: '[Sync] BullMQ + Redis outbox queue infrastructure (API)',
    labels: ['sync', 'post-pilot'],
    body: `## Goal
Add an outbox queue to the API so that mutations (marks, fees, student updates) are captured as events and can be replayed or synced to a cloud instance.

## Acceptance Criteria
- [ ] Redis service added to \`docker-compose.yml\` (redis:7-alpine)
- [ ] BullMQ installed in \`apps/api\` with \`ioredis\` connection
- [ ] \`platform.outbox_events\` table: \`(id uuid, tenant_id, entity_type, entity_id, operation, payload jsonb, created_at, processed_at)\`
- [ ] DB trigger (or service layer hook) captures INSERT/UPDATE on marks, fees, student writes → inserts to outbox
- [ ] BullMQ worker drains outbox at configurable interval
- [ ] Worker is idempotent: uses event UUID as job ID (no double-processing)
- [ ] \`GET /sync/status\` returns queue depth + last-processed timestamp

## Technical Notes
- Outbox pattern prevents lost updates on network failure
- Queue depth visible on admin dashboard (future)
- Post-pilot — not required for UTC Kyema go-live

## Status
Post-pilot backlog`,
  },
  {
    title: '[Sync] POST /sync/flush — server-side sync receive endpoint',
    labels: ['sync', 'post-pilot'],
    body: `## Goal
Add an API endpoint that accepts a batch of offline events from a client outbox and applies them to the database with idempotency guarantees.

## Acceptance Criteria
- [ ] \`POST /sync/flush\` accepts array of event objects: \`{ eventId, entityType, entityId, operation, payload, clientTimestamp }\`
- [ ] Each event is processed with idempotency key = \`eventId\` (UUID)
- [ ] Already-applied events are silently skipped (idempotent)
- [ ] Conflict detection per entity type:
  - Marks: reject if server version is newer (return \`409 Conflict\` with server value)
  - Student fields: last-write-wins using \`clientTimestamp\`
  - Config: always reject (config follows draft→publish workflow)
- [ ] Returns: \`{ applied: N, skipped: N, conflicts: [{eventId, reason, serverValue}] }\`
- [ ] Requires \`requireAuth\` middleware (tenant-scoped)
- [ ] Rate limited (max 500 events per flush call)

## Technical Notes
- Uses \`withTenant()\` for all DB writes
- Event log stored in \`platform.outbox_events\` (links to BullMQ issue)

## Status
Post-pilot backlog — depends on BullMQ outbox infrastructure`,
  },
  {
    title: '[Sync] IndexedDB client-side outbox queue for offline writes (Web)',
    labels: ['sync', 'post-pilot', 'frontend'],
    body: `## Goal
Add a client-side outbox in the React app so that POST/PUT/PATCH calls made while offline are queued in IndexedDB and replayed on reconnect.

## Acceptance Criteria
- [ ] \`idb\` library installed in \`apps/web\`
- [ ] \`src/lib/offlineQueue.ts\` — queue write operations to \`outbox\` IDB store when \`navigator.onLine === false\`
- [ ] Each queued item: \`{ id: uuid, url, method, body, retryCount, createdAt }\`
- [ ] Queue UI indicator in top navbar: badge showing pending count when offline
- [ ] On reconnect (\`window.addEventListener('online')\`): auto-flush queue → \`POST /sync/flush\`
- [ ] Conflicts returned from server shown as dismissable toast notifications
- [ ] Max 3 auto-retries per item; after 3 failures, mark as \`failed\` and surface in a "Sync errors" panel

## Technical Notes
- Only intercept mutations (POST/PUT/PATCH/DELETE) — GET calls fail gracefully with cached data
- Optimistic UI: mutations render immediately; rollback if server rejects

## Status
Post-pilot backlog — depends on POST /sync/flush endpoint`,
  },
  {
    title: '[Sync] Service worker: PWA offline shell + background sync trigger',
    labels: ['sync', 'post-pilot', 'frontend'],
    body: `## Goal
Register a service worker via Vite PWA plugin that caches the app shell for offline load and triggers background sync when connectivity is restored.

## Acceptance Criteria
- [ ] \`vite-plugin-pwa\` installed and configured in \`apps/web/vite.config.ts\`
- [ ] App shell (HTML, JS bundles, CSS) precached on install
- [ ] API GET responses cached with \`stale-while-revalidate\` strategy (student list, marks list)
- [ ] Background Sync API (\`SyncManager\`) registered: tag \`outbox-flush\`
- [ ] On sync event: service worker calls \`/sync/flush\` with queued IndexedDB items
- [ ] Graceful degradation: if Background Sync API unavailable, falls back to \`window online\` event listener
- [ ] \`manifest.json\` configured (app name, icons, theme colour matching tenant branding)
- [ ] \`GET /health\` ping used to confirm actual API reachability (not just navigator.onLine)

## Technical Notes
- Vite PWA plugin generates SW via Workbox
- Tenant theme colour for manifest can be read from \`/tenants/:slug\` endpoint
- Test with Chrome DevTools → Application → Service Workers → Offline mode

## Status
Post-pilot backlog — depends on IndexedDB outbox queue`,
  },
  {
    title: '[Sync] Conflict resolution rules: server-authoritative marks, LWW student fields',
    labels: ['sync', 'post-pilot'],
    body: `## Goal
Define and implement the conflict resolution strategy for each entity type so that the sync system behaves predictably when offline edits collide with server changes.

## Acceptance Criteria
- [ ] \`docs/SYNC-CONFLICT-RULES.md\` documents resolution strategy per entity:
  | Entity | Strategy | Reason |
  |--------|----------|--------|
  | Marks | Server-authoritative | Grading integrity; audited append-only log |
  | Fees | Server-authoritative | Financial accuracy; requires finance officer sign-off |
  | Student profile fields | Last-write-wins (by \`clientTimestamp\`) | Low-stakes edits; registrar can correct |
  | Admission status | Reject offline changes | Workflow state machine is server-only |
  | Config (forms/nav) | Reject; use draft→publish workflow | Config versioning already handles this |

- [ ] API \`/sync/flush\` implements the above rules per \`entityType\`
- [ ] Conflict responses include \`serverValue\` so client can display a diff to the user
- [ ] Marks conflict: client is shown "Server value: X — your offline edit was not applied" toast
- [ ] Student conflict: client is shown "Your edit was accepted (last write wins)" confirmation

## Technical Notes
- Marks audit log (\`app.mark_audit_log\`) is the source of truth for all mark changes
- Do not add \`version\` columns to mark rows — use \`updated_at\` timestamp comparison

## Status
Post-pilot backlog — depends on POST /sync/flush endpoint`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch (e) { reject(new Error('JSON parse failed: ' + b)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function githubRest(path, method, payload) {
  const body = payload ? JSON.stringify(payload) : null;
  return request({
    hostname: 'api.github.com',
    path,
    method: method || 'GET',
    headers: {
      Authorization: 'bearer ' + TOKEN,
      'User-Agent': 'AMIS',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
    },
  }, body);
}

function graphql(query) {
  const body = JSON.stringify({ query });
  return request({
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      Authorization: 'bearer ' + TOKEN,
      'User-Agent': 'AMIS',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

async function ensureLabels(labelNames) {
  const existing = await githubRest(`/repos/${OWNER}/${REPO}/labels?per_page=100`);
  const existingNames = existing.data.map(l => l.name);
  const colourMap = {
    deployment: '0075ca',
    'data-migration': 'e4e669',
    sync: 'd93f0b',
    'post-pilot': 'cfd3d7',
    frontend: '7057ff',
    offline: '006b75',
  };
  for (const name of labelNames) {
    if (!existingNames.includes(name)) {
      await githubRest(`/repos/${OWNER}/${REPO}/labels`, 'POST', {
        name,
        color: colourMap[name] || 'ededed',
      });
      console.log(`  Created label: ${name}`);
    }
  }
}

async function createIssue(issue) {
  const res = await githubRest(`/repos/${OWNER}/${REPO}/issues`, 'POST', {
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });
  if (res.status !== 201) throw new Error(`Failed to create issue: ${JSON.stringify(res.data)}`);
  return res.data;
}

async function addToProject(issueNodeId) {
  const res = await graphql(`
    mutation {
      addProjectV2ItemById(input: {
        projectId: "${PROJECT_ID}"
        contentId: "${issueNodeId}"
      }) {
        item { id }
      }
    }
  `);
  if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
  return res.data.data.addProjectV2ItemById.item.id;
}

async function setStatusTodo(itemId) {
  const res = await graphql(`
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}"
        itemId: "${itemId}"
        fieldId: "${STATUS_FIELD_ID}"
        value: { singleSelectOptionId: "${TODO_OPTION_ID}" }
      }) {
        projectV2Item { id }
      }
    }
  `);
  if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!TOKEN) { console.error('GH_TOKEN not set'); process.exit(1); }

  console.log('→ Ensuring labels exist...');
  const allLabels = [...new Set(ISSUES.flatMap(i => i.labels))];
  await ensureLabels(allLabels);

  console.log(`\n→ Creating ${ISSUES.length} issues and adding to project...\n`);

  for (const issue of ISSUES) {
    try {
      const created = await createIssue(issue);
      console.log(`  ✓ Created #${created.number}: ${created.title}`);

      const itemId = await addToProject(created.node_id);
      await setStatusTodo(itemId);
      console.log(`    → Added to project (Todo)\n`);
    } catch (e) {
      console.error(`  ✗ Failed: ${issue.title}\n    ${e.message}\n`);
    }
  }

  console.log('Done.');
})();
