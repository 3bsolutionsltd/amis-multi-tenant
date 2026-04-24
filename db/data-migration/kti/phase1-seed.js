/**
 * kti/phase1-seed.js — Phase 1: Seed KTI master data
 *
 * Seeds:
 *   1. Tenant (platform.tenants) — creates or updates KTI tenant
 *   2. Programmes (app.programmes) — 10 programmes
 *   3. Grading scale (app.grading_scales)
 *   4. Fee structures (app.fee_structures)
 *   5. Staff users (platform.users + platform.user_roles)
 *
 * Usage:
 *   node db/data-migration/kti/phase1-seed.js [--dry-run]
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 */

const { randomBytes, scryptSync } = require('crypto');
const { query, withTenant, getTenantId, end } = require('../lib/db');
const { Report } = require('../lib/report');

// Mirrors apps/api/src/password.ts — scrypt with same params
function hashPassword(plaintext) {
  const salt = randomBytes(32);
  const dk = scryptSync(plaintext, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${dk.toString('hex')}`;
}

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Static KTI data ─────────────────────────────────────────────────────────

const TENANT = {
  name: 'Kasese Technical Institute',
  slug: 'kti',
  contact_email: 'kasesetechnicalinstitute@gmail.com',
  address: 'Kihara Road, Rukooki Ward, Nyamwamba Division, Kasese Municipality, Kasese District',
  phone: null,
  is_active: true,
  // TVET Act fields (GAP-T3)
  ownership_type: 'private',
  license_status: 'active',
};

const PROGRAMMES = [
  { code: 'NCBC', title: 'National Certificate in Building Construction',               level: 'certificate', department: 'Building Construction', duration_months: 24, mode: 'formal', awarding_body: 'UVTAB', accreditation_status: 'accredited', intake_capacity: 50 },
  { code: 'NCPL', title: 'National Certificate in Plumbing',                            level: 'certificate', department: 'Plumbing',             duration_months: 24, mode: 'formal', awarding_body: 'UVTAB', accreditation_status: 'accredited', intake_capacity: 50 },
  { code: 'NCAM', title: 'National Certificate in Automotive Mechanics',                level: 'certificate', department: 'Automotive',           duration_months: 24, mode: 'formal', awarding_body: 'UVTAB', accreditation_status: 'accredited', intake_capacity: 50 },
  { code: 'NCES', title: 'National Certificate in Electrical Systems and Maintenance',  level: 'certificate', department: 'Electrical',            duration_months: 24, mode: 'formal', awarding_body: 'UVTAB', accreditation_status: 'accredited', intake_capacity: 50 },
  { code: 'NCAP', title: 'National Certificate in Agriculture Production',              level: 'certificate', department: 'Agriculture',           duration_months: 24, mode: 'formal', awarding_body: 'UVTAB', accreditation_status: 'accredited', intake_capacity: 50 },
  { code: 'HDC',  title: 'Hair Dressing and Cosmetology',                              level: 'certificate', department: null,                    duration_months: null, mode: 'nonformal', awarding_body: null, accreditation_status: 'accredited', intake_capacity: null },
  { code: 'ACR',  title: 'Air Conditioning and Refrigeration',                          level: 'certificate', department: null,                    duration_months: null, mode: 'nonformal', awarding_body: null, accreditation_status: 'accredited', intake_capacity: null },
  { code: 'FD',   title: 'Fashion and Design',                                          level: 'certificate', department: null,                    duration_months: null, mode: 'nonformal', awarding_body: null, accreditation_status: 'accredited', intake_capacity: null },
  { code: 'WLD',  title: 'Welding',                                                     level: 'certificate', department: null,                    duration_months: null, mode: 'nonformal', awarding_body: null, accreditation_status: 'accredited', intake_capacity: null },
  { code: 'BC',   title: 'Building Construction (Short Course)',                        level: 'certificate', department: null,                    duration_months: null, mode: 'nonformal', awarding_body: null, accreditation_status: 'accredited', intake_capacity: null },
];

// KTI 7-band grading scale (lower bands C and F are estimated — confirm with KTI)
const GRADING_BANDS = [
  { min_score: 80,   max_score: 100,  grade_letter: 'A',  grade_point: 5.0, description: 'Distinction' },
  { min_score: 75,   max_score: 79.9, grade_letter: 'B+', grade_point: 4.5, description: 'Credit' },
  { min_score: 70,   max_score: 74.9, grade_letter: 'B',  grade_point: 4.0, description: 'Credit' },
  { min_score: 65,   max_score: 69.9, grade_letter: 'B-', grade_point: 3.5, description: 'Credit' },
  { min_score: 60,   max_score: 64.9, grade_letter: 'C+', grade_point: 3.0, description: 'Pass' },
  { min_score: 50,   max_score: 59.9, grade_letter: 'C',  grade_point: 2.0, description: 'Pass' },
  { min_score: 0,    max_score: 49.9, grade_letter: 'F',  grade_point: 0.0, description: 'Fail' },
];

// Fee structure from the KTI admission letter (per term unless noted)
const FEE_STRUCTURES = [
  { name: 'Tuition + Development + Hostel + Utilities (Boarding)', fee_type: 'boarding_full', amount: 689000, currency: 'UGX', frequency: 'per_term' },
  { name: 'Tuition + Development (Day Scholar)', fee_type: 'day_full', amount: 539000, currency: 'UGX', frequency: 'per_term' },
  { name: 'Guild Fee', fee_type: 'guild', amount: 15000, currency: 'UGX', frequency: 'per_term' },
  { name: 'Admission Fee', fee_type: 'admission', amount: 10000, currency: 'UGX', frequency: 'once' },
  { name: 'Uniform', fee_type: 'uniform', amount: 65000, currency: 'UGX', frequency: 'once' },
  { name: 'Institute ID Card', fee_type: 'id_card', amount: 15000, currency: 'UGX', frequency: 'once' },
];

// Staff from sheet8 of the general workbook
const STAFF = [
  { first_name: 'Generous',  last_name: 'Agaba',           email: 'agabag56@gmail.com',                phone: '+256779803595', role: 'admin',     department: 'Administration', designation: 'Administrator' },
  { first_name: 'Dickens',   last_name: 'Olwoch Koma',     email: 'olwochdkoma@gmail.com',             phone: '+256775000414', role: 'dean',      department: 'Management',    designation: 'Principal' },
  { first_name: 'Fortunate', last_name: 'Azairwe',         email: 'fortunateazairwe032@gmail.com',     phone: '+256785010834', role: 'registrar', department: 'Registry',      designation: 'Registrar' },
  { first_name: 'Samuel',    last_name: 'Muhindo',         email: 'muhindosamuel0@gmail.com',          phone: '+256787176354', role: 'finance',   department: 'Finance',       designation: 'Finance Officer' },
  { first_name: 'Isaac',     last_name: 'Twesigye',        email: 'twesigyeisa@gmail.com',             phone: '+256784975857', role: 'hod',       department: 'Building Construction', designation: 'Head of Department' },
];

const TEMP_PASSWORD = 'KTI@Change2026!';  // must be changed on first login

// ─── Seeder ──────────────────────────────────────────────────────────────────

async function run() {
  const report = new Report('phase1-seed', 'kti');

  if (DRY_RUN) {
    console.log('DRY RUN — no data will be written to the database.\n');
  }

  // 1. Tenant
  console.log('1. Seeding tenant...');
  let tenantId;
  try {
    const existing = await query('SELECT id FROM platform.tenants WHERE slug = $1', [TENANT.slug]);
    if (existing.rows.length > 0) {
      tenantId = existing.rows[0].id;
      if (!DRY_RUN) {
        await query(
          `UPDATE platform.tenants SET name=$1, contact_email=$2, address=$3, phone=$4,
           is_active=$5, ownership_type=$6, license_status=$7 WHERE id=$8`,
          [TENANT.name, TENANT.contact_email, TENANT.address, TENANT.phone, TENANT.is_active,
           TENANT.ownership_type, TENANT.license_status, tenantId]
        );
      }
      report.updated(`Tenant ${TENANT.slug} (id=${tenantId})`);
      console.log(`  Updated existing tenant: ${tenantId}`);
    } else {
      if (!DRY_RUN) {
        const res = await query(
          `INSERT INTO platform.tenants (name, slug, contact_email, address, phone, is_active, ownership_type, license_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [TENANT.name, TENANT.slug, TENANT.contact_email, TENANT.address, TENANT.phone,
           TENANT.is_active, TENANT.ownership_type, TENANT.license_status]
        );
        tenantId = res.rows[0].id;
      } else {
        tenantId = '00000000-0000-0000-0000-000000000001'; // placeholder for dry-run
      }
      report.inserted(`Tenant ${TENANT.slug}`);
      console.log(`  Inserted tenant: ${tenantId}`);
    }
  } catch (err) {
    report.error('tenant', err);
    console.error('  FATAL: Could not seed tenant:', err.message);
    await end();
    process.exit(1);
  }

  // 2. Programmes
  console.log('\n2. Seeding programmes...');
  await withTenant(tenantId, async (client) => {
    for (const p of PROGRAMMES) {
      try {
        const existing = await client.query(
          'SELECT id FROM app.programmes WHERE tenant_id=$1 AND code=$2',
          [tenantId, p.code]
        );
        if (existing.rows.length > 0) {
          if (!DRY_RUN) {
            await client.query(
              `UPDATE app.programmes SET title=$1, level=$2, duration_months=$3, mode=$4,
               awarding_body=$5, accreditation_status=$6, intake_capacity=$7, department=$8 WHERE id=$9`,
              [p.title, p.level, p.duration_months, p.mode, p.awarding_body,
               p.accreditation_status, p.intake_capacity, p.department, existing.rows[0].id]
            );
          }
          report.updated(`Programme ${p.code}`);
        } else {
          if (!DRY_RUN) {
            await client.query(
              `INSERT INTO app.programmes (tenant_id, code, title, level, duration_months, mode, awarding_body, accreditation_status, intake_capacity, department)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [tenantId, p.code, p.title, p.level, p.duration_months, p.mode,
               p.awarding_body, p.accreditation_status, p.intake_capacity, p.department]
            );
          }
          report.inserted(`Programme ${p.code}`);
        }
      } catch (err) {
        report.error(`Programme ${p.code}`, err);
      }
    }
  });

  // 3. Grading scale
  console.log('\n3. Seeding grading scale...');
  await withTenant(tenantId, async (client) => {
    // Check if scale already exists
    const existing = await client.query(
      'SELECT id FROM app.grading_scales WHERE tenant_id=$1 LIMIT 1',
      [tenantId]
    );
    if (existing.rows.length > 0) {
      console.log('  Grading scale already exists — skipping.');
      report.skipped('Grading scale already seeded');
    } else {
      try {
        let scaleId;
        if (!DRY_RUN) {
          const scaleRes = await client.query(
            `INSERT INTO app.grading_scales (tenant_id, name, is_default) VALUES ($1,$2,$3) RETURNING id`,
            [tenantId, 'UVTAB Standard', true]
          );
          scaleId = scaleRes.rows[0].id;
        } else {
          scaleId = '00000000-0000-0000-0000-000000000002';
        }
        report.inserted('Grading scale (UVTAB Standard)');
        for (const band of GRADING_BANDS) {
          try {
            if (!DRY_RUN) {
              await client.query(
                `INSERT INTO app.grade_boundaries (grading_scale_id, grade_letter, description, min_score, max_score, grade_point)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [scaleId, band.grade_letter, band.description, band.min_score, band.max_score, band.grade_point]
              );
            }
            report.inserted(`Grade band ${band.grade_letter}`);
          } catch (err) {
            report.error(`Grade band ${band.grade_letter}`, err);
          }
        }
      } catch (err) {
        report.error('Grading scale', err);
      }
    }
  });

  // 4. Fee structures
  // NOTE: app.fee_structures requires academic_year_id (NOT NULL) + programme_id (NOT NULL) FKs
  // and only accepts fee_type IN ('tuition','functional','examination','other').
  // KTI's flat fee amounts (boarding_full, day_full, etc.) don't map to this schema directly.
  // Fee structures must be created manually via the UI once academic years and programmes are set up.
  console.log('\n4. Seeding fee structures — SKIPPED (requires academic_year_id + programme_id; seed manually via UI).');
  report.skipped('Fee structures deferred — seed via UI after creating academic years');

  // 5. Staff users
  console.log('\n5. Seeding staff users...');
  const passwordHash = DRY_RUN ? 'dry-run-hash' : hashPassword(TEMP_PASSWORD);

  for (const s of STAFF) {
    try {
      const existing = await query(
        'SELECT id FROM platform.users WHERE email=$1', [s.email]
      );
      let userId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        report.updated(`User ${s.email}`);
        console.log(`  User exists: ${s.email}`);
      } else {
        if (!DRY_RUN) {
          const res = await query(
            `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [tenantId, s.email, passwordHash, s.role, true]
          );
          userId = res.rows[0].id;
        } else {
          userId = crypto.randomUUID();
        }
        report.inserted(`User ${s.email}`);
        console.log(`  Inserted user: ${s.email}`);
      }

      // Role is stored directly on platform.users.role — no user_roles insert needed

      // Staff profile
      await withTenant(tenantId, async (client) => {
        const sp = await client.query(
          'SELECT id FROM app.staff_profiles WHERE tenant_id=$1 AND email=$2',
          [tenantId, s.email]
        );
        if (sp.rows.length === 0 && !DRY_RUN) {
          const staffNum = `KTI-${String(STAFF.indexOf(s) + 1).padStart(3, '0')}`;
          await client.query(
            `INSERT INTO app.staff_profiles (tenant_id, staff_number, first_name, last_name, email, phone, department, designation, employment_type, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'full_time',true)`,
            [tenantId, staffNum, s.first_name, s.last_name, s.email, s.phone, s.department, s.designation]
          );
        }
      });

    } catch (err) {
      report.error(`Staff ${s.email}`, err);
    }
  }

  report.print();

  if (!DRY_RUN) {
    console.log(`\nTemporary password for all staff: ${TEMP_PASSWORD}`);
    console.log('Instruct staff to change their password on first login.');
  }

  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
