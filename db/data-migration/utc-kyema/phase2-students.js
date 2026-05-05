/**
 * utc-kyema/phase2-students.js — Phase 2: Import UTC Kyema student register
 *
 * STATUS: AWAITING SOURCE DATA
 *   UTC Kyema must provide the student register as an Excel or CSV file.
 *   Place the file at: db/data-migration/utc-kyema/raw/students.xlsx
 *
 * Once the file is available:
 *   1. Complete the COLUMN_MAP below to match the actual Excel column headers
 *   2. Run: node db/data-migration/utc-kyema/phase2-students.js [--dry-run]
 *
 * Expected columns (based on UTC-KYEMA-ANALYSIS.md):
 *   - Surname (last_name)
 *   - Other Name (first_name)
 *   - Gender (M/F)
 *   - Date of Birth (dob)
 *   - Programme code (NCBC / NCES / NCAM / NCP / NCWF)
 *   - Sponsorship type (Government / Private)
 *   - Intake year (e.g. 2026)
 *   - Phone (optional)
 *   - Email (optional)
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { query, withTenant, getTenantId, end } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN = process.argv.includes('--dry-run');
const RAW_DIR = path.join(__dirname, 'raw');
const SOURCE_FILE = path.join(RAW_DIR, 'students.xlsx');

// TODO: Update these keys to match the actual Excel column headers once the file is provided.
// Keys must exactly match the header row in the Excel sheet (case-sensitive).
const COLUMN_MAP = {
  last_name:        'Surname',           // required
  first_name:       'Other Name',        // required
  gender:           'Gender',            // required — 'M' or 'F'
  dob:              'Date of Birth',     // required — DD/MM/YYYY
  programme_code:   'Programme',         // required — NCBC / NCES / NCAM / NCP / NCWF
  sponsorship_type: 'Sponsorship',       // required — Government / Private
  intake:           'Intake Year',       // required — e.g. 2026
  phone:            'Phone',             // optional
  email:            'Email',             // optional
};

// TODO: Set the sheet name / index once the file structure is confirmed.
const SHEET_NAME_OR_INDEX = 0; // first sheet

async function run() {
  const report = new Report('phase2-students', 'utc-kyema');

  // Guard: source file must exist
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`\nSOURCE FILE NOT FOUND: ${SOURCE_FILE}`);
    console.error('Place the UTC Kyema student register Excel file at:');
    console.error(`  ${SOURCE_FILE}`);
    console.error('\nThis phase is blocked until UTC Kyema provides the file.\n');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('DRY RUN — no data will be written to the database.\n');
  }

  // Lazy-load xlsx (not installed until needed)
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('xlsx package not found. Install it: pnpm add -D xlsx');
    process.exit(1);
  }

  const tenantId = await getTenantId('utc-kyema');
  if (!tenantId) {
    console.error('Tenant utc-kyema not found — run phase1-seed.js first.');
    await end();
    process.exit(1);
  }

  // Load workbook
  const wb = XLSX.readFile(SOURCE_FILE);
  const ws =
    typeof SHEET_NAME_OR_INDEX === 'number'
      ? wb.Sheets[wb.SheetNames[SHEET_NAME_OR_INDEX]]
      : wb.Sheets[SHEET_NAME_OR_INDEX];

  if (!ws) {
    console.error(`Sheet "${SHEET_NAME_OR_INDEX}" not found in workbook.`);
    await end();
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Loaded ${rows.length} rows from ${path.basename(SOURCE_FILE)}\n`);

  await withTenant(tenantId, async (client) => {
    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2; // 1-based + header row

      // Map columns
      const lastName       = String(row[COLUMN_MAP.last_name] ?? '').trim();
      const firstName      = String(row[COLUMN_MAP.first_name] ?? '').trim();
      const genderRaw      = String(row[COLUMN_MAP.gender] ?? '').trim().toUpperCase();
      const dobRaw         = String(row[COLUMN_MAP.dob] ?? '').trim();
      const programmeCode  = String(row[COLUMN_MAP.programme_code] ?? '').trim().toUpperCase();
      const sponsorshipRaw = String(row[COLUMN_MAP.sponsorship_type] ?? '').trim().toLowerCase();
      const intakeRaw      = String(row[COLUMN_MAP.intake] ?? '').trim();
      const phone          = String(row[COLUMN_MAP.phone] ?? '').trim() || null;
      const email          = String(row[COLUMN_MAP.email] ?? '').trim().toLowerCase() || null;

      // Basic validation
      if (!lastName || !firstName) {
        report.skipped(`Row ${rowNum}: missing name (${JSON.stringify({ lastName, firstName })})`);
        continue;
      }

      // Gender normalisation
      const gender = genderRaw === 'M' ? 'male' : genderRaw === 'F' ? 'female' : null;
      if (!gender) {
        report.error(`Row ${rowNum}`, new Error(`Unknown gender: ${genderRaw}`));
        continue;
      }

      // Sponsorship normalisation
      const sponsorshipType =
        sponsorshipRaw.startsWith('gov') ? 'government'
        : sponsorshipRaw.startsWith('priv') ? 'private'
        : null;
      if (!sponsorshipType) {
        report.error(`Row ${rowNum}`, new Error(`Unknown sponsorship: ${sponsorshipRaw}`));
        continue;
      }

      // Programme lookup
      const progRes = await client.query(
        'SELECT id FROM app.programmes WHERE tenant_id=$1 AND code=$2',
        [tenantId, programmeCode]
      );
      if (progRes.rows.length === 0) {
        report.error(`Row ${rowNum}`, new Error(`Programme not found: ${programmeCode}`));
        continue;
      }
      const programmeId = progRes.rows[0].id;

      // Parse intake year
      const intake = parseInt(intakeRaw, 10) || null;

      try {
        // Upsert student (match on full name + programme + intake as natural key for now)
        const existing = await client.query(
          `SELECT id FROM app.students
           WHERE tenant_id=$1 AND last_name=$2 AND first_name=$3
             AND programme_id=$4 AND intake=$5`,
          [tenantId, lastName, firstName, programmeId, intake]
        );

        if (existing.rows.length > 0) {
          report.skipped(`Row ${rowNum}: ${firstName} ${lastName} already exists`);
        } else {
          if (!DRY_RUN) {
            await client.query(
              `INSERT INTO app.students
                 (tenant_id, first_name, last_name, gender, dob, programme_id,
                  sponsorship_type, intake, phone, email)
               VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10)`,
              [
                tenantId, firstName, lastName, gender,
                dobRaw || null, programmeId, sponsorshipType, intake, phone, email,
              ]
            );
          }
          report.inserted(`${firstName} ${lastName} (${programmeCode})`);
        }
      } catch (err) {
        report.error(`Row ${rowNum}: ${firstName} ${lastName}`, err);
      }
    }
  });

  report.print();
  await end();
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
