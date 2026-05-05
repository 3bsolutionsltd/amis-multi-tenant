/**
 * utc-kyema/phase1-seed.js — Phase 1: Seed UTC Kyema master data
 *
 * Seeds:
 *   1. Tenant (platform.tenants)
 *   2. Programmes (app.programmes) — 5 UVTAB programmes
 *   3. Grading scale (app.grading_scales + app.grade_boundaries)
 *   4. Fee structures — SKIPPED (amounts TBC; seed via Admin Studio)
 *   5. Staff users (platform.users + app.staff_profiles)
 *
 * Usage:
 *   node db/data-migration/utc-kyema/phase1-seed.js [--dry-run]
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 */

const { randomBytes, scryptSync } = require('crypto');
const { query, withTenant, end } = require('../lib/db');
const { Report } = require('../lib/report');

// Mirrors apps/api/src/password.ts — scrypt with same params
function hashPassword(plaintext) {
  const salt = randomBytes(32);
  const dk = scryptSync(plaintext, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${dk.toString('hex')}`;
}

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Static UTC Kyema data ────────────────────────────────────────────────────

const TENANT = {
  name: 'Uganda Technical College — Kyema',
  slug: 'utc-kyema',
  contact_email: 'ugatechkyema@yahoo.com',
  address: '5 KM Masindi–Kiryandongo Rd, P.O. Box 473 Masindi, Uganda',
  phone: '+256465423396',
  is_active: true,
  ownership_type: 'government',
  license_status: 'active',
};

// 5 UVTAB National Certificate programmes — all 2 years formal
const PROGRAMMES = [
  {
    code: 'NCBC',
    title: 'National Certificate in Building Construction',
    level: 'certificate',
    department: 'Building Construction',
    duration_months: 24,
    mode: 'formal',
    awarding_body: 'UVTAB',
    accreditation_status: 'accredited',
    intake_capacity: 50,
  },
  {
    code: 'NCES',
    title: 'National Certificate in Electrical Systems and Management',
    level: 'certificate',
    department: 'Electrical',
    duration_months: 24,
    mode: 'formal',
    awarding_body: 'UVTAB',
    accreditation_status: 'accredited',
    intake_capacity: 50,
  },
  {
    code: 'NCAM',
    title: 'National Certificate in Automotive Mechanics',
    level: 'certificate',
    department: 'Automotive',
    duration_months: 24,
    mode: 'formal',
    awarding_body: 'UVTAB',
    accreditation_status: 'accredited',
    intake_capacity: 50,
  },
  {
    code: 'NCP',
    title: 'National Certificate in Plumbing',
    level: 'certificate',
    department: 'Plumbing',
    duration_months: 24,
    mode: 'formal',
    awarding_body: 'UVTAB',
    accreditation_status: 'accredited',
    intake_capacity: 50,
  },
  {
    code: 'NCWF',
    title: 'National Certificate in Welding and Fabrication',
    level: 'certificate',
    department: 'Welding',
    duration_months: 24,
    mode: 'formal',
    awarding_body: 'UVTAB',
    accreditation_status: 'accredited',
    intake_capacity: 50,
  },
];

// UVTAB 7-band grading scale — same as KTI standard (confirm with UTC Kyema registrar)
const GRADING_BANDS = [
  { min_score: 80,   max_score: 100,  grade_letter: 'D1', grade_point: 4.0, description: 'Distinction' },
  { min_score: 70,   max_score: 79.9, grade_letter: 'D2', grade_point: 3.0, description: 'Distinction' },
  { min_score: 60,   max_score: 69.9, grade_letter: 'C3', grade_point: 2.5, description: 'Credit' },
  { min_score: 55,   max_score: 59.9, grade_letter: 'C4', grade_point: 2.0, description: 'Credit' },
  { min_score: 50,   max_score: 54.9, grade_letter: 'P5', grade_point: 1.5, description: 'Pass' },
  { min_score: 45,   max_score: 49.9, grade_letter: 'P6', grade_point: 1.0, description: 'Pass' },
  { min_score: 0,    max_score: 44.9, grade_letter: 'F9', grade_point: 0.0, description: 'Fail' },
];

// Fee amounts are TBC — configure via Admin Studio after deployment.
// This seed intentionally omits fee_structures (requires academic_year_id FK).

// Staff — placeholders; update email/phone from UTC Kyema before running.
// Role mapping: Academic Registrar→registrar, Accounts→finance, HOD→hod,
//               Dean of Students→dean, Principal→principal, ICT Technician→admin
const STAFF = [
  {
    first_name: 'TBC',
    last_name: 'Registrar',
    email: 'registrar@utckyema.ac.ug',
    phone: null,
    role: 'registrar',
    department: 'Registry',
    designation: 'Academic Registrar',
  },
  {
    first_name: 'TBC',
    last_name: 'Accounts',
    email: 'accounts@utckyema.ac.ug',
    phone: null,
    role: 'finance',
    department: 'Finance',
    designation: 'Accounts Officer',
  },
  {
    first_name: 'TBC',
    last_name: 'HOD NCBC',
    email: 'hod.ncbc@utckyema.ac.ug',
    phone: null,
    role: 'hod',
    department: 'Building Construction',
    designation: 'Head of Department',
  },
  {
    first_name: 'TBC',
    last_name: 'HOD NCES',
    email: 'hod.nces@utckyema.ac.ug',
    phone: null,
    role: 'hod',
    department: 'Electrical',
    designation: 'Head of Department',
  },
  {
    first_name: 'TBC',
    last_name: 'HOD NCAM',
    email: 'hod.ncam@utckyema.ac.ug',
    phone: null,
    role: 'hod',
    department: 'Automotive',
    designation: 'Head of Department',
  },
  {
    first_name: 'TBC',
    last_name: 'HOD NCP',
    email: 'hod.ncp@utckyema.ac.ug',
    phone: null,
    role: 'hod',
    department: 'Plumbing',
    designation: 'Head of Department',
  },
  {
    first_name: 'TBC',
    last_name: 'HOD NCWF',
    email: 'hod.ncwf@utckyema.ac.ug',
    phone: null,
    role: 'hod',
    department: 'Welding',
    designation: 'Head of Department',
  },
  {
    first_name: 'TBC',
    last_name: 'Dean',
    email: 'dean@utckyema.ac.ug',
    phone: null,
    role: 'dean',
    department: 'Student Affairs',
    designation: 'Dean of Students',
  },
  {
    first_name: 'TBC',
    last_name: 'Principal',
    email: 'principal@utckyema.ac.ug',
    phone: null,
    role: 'principal',
    department: 'Management',
    designation: 'Principal',
  },
  {
    first_name: 'TBC',
    last_name: 'ICT',
    email: 'ict@utckyema.ac.ug',
    phone: null,
    role: 'admin',
    department: 'ICT',
    designation: 'ICT Technician',
  },
];

const TEMP_PASSWORD = 'UTC@Change2026!'; // must be changed on first login

// ─── Seeder ──────────────────────────────────────────────────────────────────

async function run() {
  const report = new Report('phase1-seed', 'utc-kyema');

  if (DRY_RUN) {
    console.log('DRY RUN — no data will be written to the database.\n');
  }

  // 1. Tenant
  console.log('1. Seeding tenant...');
  let tenantId;
  try {
    const existing = await query(
      'SELECT id FROM platform.tenants WHERE slug = $1',
      [TENANT.slug]
    );
    if (existing.rows.length > 0) {
      tenantId = existing.rows[0].id;
      if (!DRY_RUN) {
        await query(
          `UPDATE platform.tenants
           SET name=$1, contact_email=$2, address=$3, phone=$4,
               is_active=$5, ownership_type=$6, license_status=$7
           WHERE id=$8`,
          [
            TENANT.name, TENANT.contact_email, TENANT.address, TENANT.phone,
            TENANT.is_active, TENANT.ownership_type, TENANT.license_status,
            tenantId,
          ]
        );
      }
      report.updated(`Tenant ${TENANT.slug} (id=${tenantId})`);
      console.log(`  Updated existing tenant: ${tenantId}`);
    } else {
      if (!DRY_RUN) {
        const res = await query(
          `INSERT INTO platform.tenants
             (name, slug, contact_email, address, phone, is_active, ownership_type, license_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            TENANT.name, TENANT.slug, TENANT.contact_email, TENANT.address,
            TENANT.phone, TENANT.is_active, TENANT.ownership_type, TENANT.license_status,
          ]
        );
        tenantId = res.rows[0].id;
      } else {
        tenantId = '00000000-0000-0000-0000-000000000001';
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
              `UPDATE app.programmes
               SET title=$1, level=$2, duration_months=$3, mode=$4,
                   awarding_body=$5, accreditation_status=$6, intake_capacity=$7, department=$8
               WHERE id=$9`,
              [
                p.title, p.level, p.duration_months, p.mode,
                p.awarding_body, p.accreditation_status, p.intake_capacity,
                p.department, existing.rows[0].id,
              ]
            );
          }
          report.updated(`Programme ${p.code}`);
        } else {
          if (!DRY_RUN) {
            await client.query(
              `INSERT INTO app.programmes
                 (tenant_id, code, title, level, duration_months, mode,
                  awarding_body, accreditation_status, intake_capacity, department)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [
                tenantId, p.code, p.title, p.level, p.duration_months, p.mode,
                p.awarding_body, p.accreditation_status, p.intake_capacity, p.department,
              ]
            );
          }
          report.inserted(`Programme ${p.code}`);
        }
        console.log(`  ${existing.rows.length > 0 ? 'Updated' : 'Inserted'} programme: ${p.code}`);
      } catch (err) {
        report.error(`Programme ${p.code}`, err);
      }
    }
  });

  // 3. Grading scale
  console.log('\n3. Seeding grading scale...');
  await withTenant(tenantId, async (client) => {
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
                `INSERT INTO app.grade_boundaries
                   (grading_scale_id, grade_letter, description, min_score, max_score, grade_point)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [scaleId, band.grade_letter, band.description, band.min_score, band.max_score, band.grade_point]
              );
            }
            report.inserted(`Grade band ${band.grade_letter}`);
          } catch (err) {
            report.error(`Grade band ${band.grade_letter}`, err);
          }
        }
        console.log(`  Inserted grading scale with ${GRADING_BANDS.length} bands`);
      } catch (err) {
        report.error('Grading scale', err);
      }
    }
  });

  // 4. Fee structures — deferred (requires academic_year_id + programme_id FKs)
  console.log(
    '\n4. Fee structures — SKIPPED\n' +
    '   Amounts are TBC from UTC Kyema. Seed via Admin Studio after creating academic years.'
  );
  report.skipped('Fee structures deferred — seed via Admin Studio after creating academic years');

  // 5. Staff users
  console.log('\n5. Seeding staff users...');
  console.log('   NOTE: Placeholder emails used — update STAFF array with real contacts before running in production.');

  const passwordHash = DRY_RUN ? 'dry-run-hash' : hashPassword(TEMP_PASSWORD);

  for (const [i, s] of STAFF.entries()) {
    try {
      const existing = await query(
        'SELECT id FROM platform.users WHERE email=$1',
        [s.email]
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
          userId = `dry-run-user-${i}`;
        }
        report.inserted(`User ${s.email}`);
        console.log(`  Inserted user: ${s.email} (${s.role})`);
      }

      // Staff profile
      await withTenant(tenantId, async (client) => {
        const sp = await client.query(
          'SELECT id FROM app.staff_profiles WHERE tenant_id=$1 AND email=$2',
          [tenantId, s.email]
        );
        if (sp.rows.length === 0 && !DRY_RUN) {
          const staffNum = `UTC-${String(i + 1).padStart(3, '0')}`;
          await client.query(
            `INSERT INTO app.staff_profiles
               (tenant_id, staff_number, first_name, last_name, email, phone,
                department, designation, employment_type, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'full_time',true)`,
            [
              tenantId, staffNum, s.first_name, s.last_name, s.email,
              s.phone, s.department, s.designation,
            ]
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
    console.log('Instruct all users to change their password on first login.\n');
  }

  await end();
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
