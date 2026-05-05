/**
 * utc-kyema/verify-production.js — Post-migration spot-check for production
 *
 * Runs a series of sanity checks against the live database and writes a
 * verification log to production-migration-log.md in the same directory.
 *
 * Run this immediately after completing all migration phases on production.
 *
 * Usage:
 *   node db/data-migration/utc-kyema/verify-production.js
 *
 * Requires: DATABASE_URL pointing to the production / offline-bundle database
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { query, withTenant, getTenantId, end } = require('../lib/db');

const TENANT_SLUG = 'utc-kyema';
const LOG_FILE    = path.join(__dirname, 'production-migration-log.md');

const EXPECTED_PROGRAMMES   = ['NCBC', 'NCES', 'NCAM', 'NCP', 'NCWF'];
const EXPECTED_GRADE_BANDS  = 7;
const EXPECTED_STAFF_ROLES  = ['registrar', 'finance', 'hod', 'dean', 'principal', 'admin'];

const checks = [];
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) passed++; else failed++;
  checks.push({ status, name, detail });
  console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function run() {
  const startedAt = new Date().toISOString();
  console.log('=== UTC Kyema — Production Migration Verification ===\n');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenantRes = await query(
    'SELECT id, name, is_active FROM platform.tenants WHERE slug=$1',
    [TENANT_SLUG]
  );
  check(
    'Tenant exists',
    tenantRes.rows.length === 1,
    tenantRes.rows[0]?.name ?? 'NOT FOUND'
  );

  if (tenantRes.rows.length === 0) {
    console.error('\nFATAL: Tenant not found. Aborting verification.');
    await end();
    process.exit(1);
  }

  const tenantId = tenantRes.rows[0].id;
  check('Tenant is active', tenantRes.rows[0].is_active === true);

  await withTenant(tenantId, async (client) => {
    // ── Programmes ───────────────────────────────────────────────────────
    const progRes = await client.query(
      'SELECT code FROM app.programmes WHERE tenant_id=$1',
      [tenantId]
    );
    const foundCodes = progRes.rows.map((r) => r.code);
    check(
      `All 5 programmes present`,
      EXPECTED_PROGRAMMES.every((c) => foundCodes.includes(c)),
      `Found: ${foundCodes.join(', ')}`
    );

    // ── Grading scale ─────────────────────────────────────────────────────
    const scaleRes = await client.query(
      `SELECT gs.id, COUNT(gb.id)::int AS bands
       FROM app.grading_scales gs
       LEFT JOIN app.grade_boundaries gb ON gb.grading_scale_id = gs.id
       WHERE gs.tenant_id = $1 AND gs.is_default = true
       GROUP BY gs.id`,
      [tenantId]
    );
    check('Default grading scale exists', scaleRes.rows.length >= 1);
    if (scaleRes.rows.length > 0) {
      check(
        `Grading scale has ${EXPECTED_GRADE_BANDS} bands`,
        scaleRes.rows[0].bands === EXPECTED_GRADE_BANDS,
        `Found: ${scaleRes.rows[0].bands}`
      );
    }

    // ── Staff / Users ─────────────────────────────────────────────────────
    const userRes = await client.query(
      `SELECT role FROM platform.users WHERE tenant_id=$1 AND is_active=true`,
      [tenantId]
    );
    const foundRoles = [...new Set(userRes.rows.map((r) => r.role))];
    for (const role of EXPECTED_STAFF_ROLES) {
      check(
        `At least one user with role: ${role}`,
        foundRoles.includes(role),
        foundRoles.includes(role) ? '✓' : 'MISSING'
      );
    }

    // ── Students ──────────────────────────────────────────────────────────
    const studentRes = await client.query(
      'SELECT COUNT(*)::int AS total FROM app.students WHERE tenant_id=$1',
      [tenantId]
    );
    const studentCount = studentRes.rows[0].total;
    check(
      'Students imported (phase2)',
      studentCount > 0,
      `${studentCount} students found`
    );

    if (studentCount > 0) {
      // Spot-check: every student has a programme
      const orphanRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM app.students s
         WHERE s.tenant_id=$1 AND s.programme_id IS NULL`,
        [tenantId]
      );
      check(
        'No students missing programme_id',
        orphanRes.rows[0].cnt === 0,
        `${orphanRes.rows[0].cnt} orphan students`
      );

      // Spot-check: every student has a sponsorship_type
      const noSponsorRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM app.students
         WHERE tenant_id=$1 AND sponsorship_type IS NULL`,
        [tenantId]
      );
      check(
        'No students missing sponsorship_type',
        noSponsorRes.rows[0].cnt === 0,
        `${noSponsorRes.rows[0].cnt} students without sponsorship`
      );
    }

    // ── Admission applications ────────────────────────────────────────────
    const appRes = await client.query(
      'SELECT COUNT(*)::int AS total FROM app.admission_applications WHERE tenant_id=$1',
      [tenantId]
    );
    console.log(`\n  INFO: ${appRes.rows[0].total} admission applications found (informational)`);
  });

  // ── Write log ─────────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();
  const lines = [
    '# UTC Kyema — Production Migration Log',
    '',
    `- **Run date:** ${startedAt}`,
    `- **Completed:** ${completedAt}`,
    `- **Tenant slug:** ${TENANT_SLUG}`,
    '',
    `## Results: ${passed} passed, ${failed} failed`,
    '',
    '| Status | Check | Detail |',
    '|--------|-------|--------|',
    ...checks.map(
      (c) => `| ${c.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${c.name} | ${c.detail} |`
    ),
    '',
    failed > 0
      ? '## Action Required\nReview FAIL items above before going live.'
      : '## All checks passed ✅\nMigration verified successfully.',
    '',
  ];

  fs.writeFileSync(LOG_FILE, lines.join('\n'), 'utf8');

  console.log('\n─────────────────────────────────────');
  console.log(`Passed : ${passed}`);
  console.log(`Failed : ${failed}`);
  console.log(`\nLog written to: ${LOG_FILE}`);

  await end();

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
