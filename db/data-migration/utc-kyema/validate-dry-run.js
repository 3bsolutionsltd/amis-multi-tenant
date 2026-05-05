/**
 * utc-kyema/validate-dry-run.js — Validates migration state after each phase
 *
 * Queries the database and prints a summary of what has been seeded.
 * Run this after any phase to confirm data landed correctly before proceeding.
 *
 * Usage:
 *   node db/data-migration/utc-kyema/validate-dry-run.js
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 */

'use strict';

const { query, withTenant, getTenantId, end } = require('../lib/db');

const TENANT_SLUG = 'utc-kyema';

async function run() {
  console.log('=== UTC Kyema — Migration Validation ===\n');

  // ── Check tenant exists ───────────────────────────────────────────────────
  const tenantRes = await query(
    `SELECT id, name, slug, is_active, created_at
     FROM platform.tenants WHERE slug = $1`,
    [TENANT_SLUG]
  );

  if (tenantRes.rows.length === 0) {
    console.error('FAIL: Tenant "utc-kyema" not found — run phase1-seed.js first.');
    await end();
    process.exit(1);
  }

  const tenant = tenantRes.rows[0];
  const tenantId = tenant.id;

  console.log('TENANT');
  console.log('  Name      :', tenant.name);
  console.log('  Slug      :', tenant.slug);
  console.log('  Active    :', tenant.is_active);
  console.log('  Created   :', tenant.created_at);
  console.log('  ID        :', tenantId);

  await withTenant(tenantId, async (client) => {
    // ── Programmes ─────────────────────────────────────────────────────────
    const progRes = await client.query(
      `SELECT code, title, mode, awarding_body, accreditation_status
       FROM app.programmes WHERE tenant_id = $1 ORDER BY code`,
      [tenantId]
    );
    console.log(`\nPROGRAMMES — ${progRes.rows.length} found (expected 5)`);
    for (const p of progRes.rows) {
      const status = p.accreditation_status === 'accredited' ? '✓' : '⚠';
      console.log(`  ${status} ${p.code} — ${p.title} (${p.awarding_body ?? 'no awarding body'})`);
    }
    if (progRes.rows.length !== 5) {
      console.warn('  WARNING: Expected 5 programmes (NCBC, NCES, NCAM, NCP, NCWF)');
    }

    // ── Grading scale ──────────────────────────────────────────────────────
    const scaleRes = await client.query(
      `SELECT gs.id, gs.name, gs.is_default, COUNT(gb.id)::int AS band_count
       FROM app.grading_scales gs
       LEFT JOIN app.grade_boundaries gb ON gb.grading_scale_id = gs.id
       WHERE gs.tenant_id = $1
       GROUP BY gs.id`,
      [tenantId]
    );
    console.log(`\nGRADING SCALES — ${scaleRes.rows.length} found (expected 1)`);
    for (const s of scaleRes.rows) {
      console.log(`  ${s.is_default ? '(default)' : ''} ${s.name} — ${s.band_count} bands (expected 7)`);
      if (s.band_count !== 7) {
        console.warn('  WARNING: Expected 7 grade bands');
      }
    }

    // ── Staff / Users ──────────────────────────────────────────────────────
    const userRes = await client.query(
      `SELECT u.email, u.role, u.is_active
       FROM platform.users u
       WHERE u.tenant_id = $1
       ORDER BY u.role, u.email`,
      [tenantId]
    );
    console.log(`\nSTAFF USERS — ${userRes.rows.length} found (expected 10)`);
    for (const u of userRes.rows) {
      const active = u.is_active ? '✓' : '✗';
      console.log(`  ${active} [${u.role.padEnd(10)}] ${u.email}`);
    }

    const staffProfilesRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM app.staff_profiles WHERE tenant_id = $1`,
      [tenantId]
    );
    console.log(`  Staff profiles: ${staffProfilesRes.rows[0].cnt}`);

    // ── Students ───────────────────────────────────────────────────────────
    const studentRes = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE sponsorship_type = 'government')::int AS govt,
              COUNT(*) FILTER (WHERE sponsorship_type = 'private')::int AS private
       FROM app.students WHERE tenant_id = $1`,
      [tenantId]
    );
    const sc = studentRes.rows[0];
    console.log(`\nSTUDENTS — ${sc.total} total`);
    console.log(`  Government : ${sc.govt}`);
    console.log(`  Private    : ${sc.private}`);

    // Students per programme
    const studByProg = await client.query(
      `SELECT p.code, COUNT(s.id)::int AS cnt
       FROM app.programmes p
       LEFT JOIN app.students s ON s.programme_id = p.id AND s.tenant_id = $1
       WHERE p.tenant_id = $1
       GROUP BY p.code ORDER BY p.code`,
      [tenantId]
    );
    for (const row of studByProg.rows) {
      console.log(`    ${row.code}: ${row.cnt} students`);
    }

    // ── Admission applications ─────────────────────────────────────────────
    const admRes = await client.query(
      `SELECT status, COUNT(*)::int AS cnt
       FROM app.admission_applications
       WHERE tenant_id = $1
       GROUP BY status ORDER BY status`,
      [tenantId]
    );
    if (admRes.rows.length > 0) {
      console.log(`\nADMISSION APPLICATIONS`);
      for (const r of admRes.rows) {
        console.log(`  ${r.status}: ${r.cnt}`);
      }
    } else {
      console.log('\nADMISSION APPLICATIONS — 0 (phase2 not yet run or no applications)');
    }
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Validation complete ===');
  console.log('Review any WARNING lines above before proceeding to the next phase.\n');

  await end();
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
