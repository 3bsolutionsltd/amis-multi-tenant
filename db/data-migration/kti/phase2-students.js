/**
 * kti/phase2-students.js — Phase 2: Import KTI student register (189 students)
 *
 * Source: KASESE TECH INST GENERAL INFORMATION.xlsx, Sheet4 (students register)
 *
 * Usage:
 *   node db/data-migration/kti/phase2-students.js [--dry-run] [--verbose]
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 */

const path = require('path');
const { readXlsx } = require('../lib/xlsx');
const { parseName, normalisePhone, normaliseGender, titleCase } = require('../lib/normalise');
const { withTenant, getTenantId, end } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

const XLSX_PATH = path.resolve(__dirname, 'raw/KASESE TECH INST GENERAL INFORMATION.xlsx');

/** Extract 2-letter programme code from verbose programme string like "NCES-M-National Certificate..." */
function extractProgrammeCode(raw) {
  if (!raw) return null;
  const m = (raw || '').match(/^([A-Z]{2,6})/);
  return m ? m[1] : null;
}

async function run() {
  const report = new Report('phase2-students', 'kti');

  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');

  // Load workbook
  console.log(`Loading workbook: ${XLSX_PATH}`);
  const sheets = readXlsx(XLSX_PATH);

  // Find students sheet (Sheet4, index 3)
  const studentSheet = sheets[3]; // 0-indexed
  if (!studentSheet) {
    console.error('Sheet4 not found in workbook');
    process.exit(1);
  }

  console.log(`Found sheet: "${studentSheet.sheetName}" — ${studentSheet.rows.length - 1} data rows`);

  const tenantId = await getTenantId('kti');
  console.log(`Tenant ID: ${tenantId}\n`);

  // Skip header row (row[0])
  const dataRows = studentSheet.rows.slice(1);

  await withTenant(tenantId, async (client) => {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Column mapping (0-indexed):
      // A=0 reg_number, B=1 first_name, C=2 last_name, D=3 other_names,
      // E=4 gender, F=5 dob, G=6 nin, H=7 phone, I=8 email,
      // J=9 district, K=10 nok_name, L=11 nok_phone, M=12 programme,
      // N=13 intake_year, O=14 status, P=15 sponsorship
      const rawRegNo      = (row[0] || '').trim();
      const rawFirstName  = (row[1] || '').trim();
      const rawLastName   = (row[2] || '').trim();
      const otherNames    = (row[3] || '').trim();
      const rawGender     = (row[4] || '').trim();
      const rawDob        = (row[5] || '').trim();
      const rawNin        = (row[6] || '').trim();
      const rawPhone      = (row[7] || '').trim();
      const rawEmail      = (row[8] || '').trim();
      const rawDistrict   = (row[9] || '').trim();
      const nokName       = (row[10] || '').trim();
      const nokPhone      = (row[11] || '').trim();
      const rawProgramme  = (row[12] || '').trim();
      const intakeYear    = (row[13] || '').trim();
      const rawStatus     = (row[14] || '').trim();
      const rawSponsor    = (row[15] || '').trim();

      // Skip blank rows
      if (!rawFirstName && !rawRegNo) {
        if (VERBOSE) console.log(`  Row ${i + 2}: blank — skipped`);
        report.skipped(`Row ${i + 2}: blank`);
        continue;
      }

      // Name parsing: if last name is blank, split first name
      const { first_name, last_name } = parseName(rawFirstName, rawLastName);
      const full_name = [last_name, first_name, otherNames].filter(Boolean).join(' ');

      const gender          = normaliseGender(rawGender);
      const phone           = normalisePhone(rawPhone);
      const email           = rawEmail.length > 0 ? rawEmail.toLowerCase() : null;
      const district        = rawDistrict.length > 0 ? titleCase(rawDistrict) : null;
      const programme_code  = extractProgrammeCode(rawProgramme);
      const is_active       = rawStatus.toLowerCase() !== 'inactive';
      const sponsorship     = rawSponsor.length > 0 ? rawSponsor : null;
      const nin             = rawNin.length > 0 ? rawNin : null;

      // Date of birth — mostly blank; skip if blank or not a valid date serial
      let date_of_birth = null;
      if (rawDob.length > 0 && !isNaN(parseFloat(rawDob))) {
        const d = new Date((parseFloat(rawDob) - 25569) * 86400 * 1000);
        if (d.getFullYear() > 1950 && d.getFullYear() < 2010) {
          date_of_birth = d.toISOString().split('T')[0];
        }
      }

      if (VERBOSE) {
        console.log(`  Row ${i + 2}: ${full_name} | ${rawRegNo} | ${programme_code} | ${gender}`);
      }

      try {
        // Check for existing student by registration_number
        const existing = await client.query(
          'SELECT id FROM app.students WHERE tenant_id=$1 AND registration_number=$2',
          [tenantId, rawRegNo || null]
        );

        if (existing.rows.length > 0) {
          report.updated(`${full_name} (${rawRegNo})`);
          if (!DRY_RUN) {
            await client.query(
              `UPDATE app.students SET
                first_name=$1, last_name=$2, other_names=$3,
                date_of_birth=$4, nin=$5, phone=$6, email=$7,
                district_of_origin=$8, guardian_name=$9, guardian_phone=$10,
                programme_code=$11, intake_year=$12, is_active=$13, sponsorship_type=$14,
                updated_at=now()
               WHERE id=$15`,
              [first_name, last_name, otherNames || null,
               date_of_birth, nin, phone, email,
               district, nokName || null, nokPhone ? normalisePhone(nokPhone) : null,
               programme_code, intakeYear || null, is_active, sponsorship,
               existing.rows[0].id]
            );
          }
        } else {
          report.inserted(`${full_name} (${rawRegNo})`);
          if (!DRY_RUN) {
            await client.query(
              `INSERT INTO app.students
                (tenant_id, first_name, last_name, other_names,
                 date_of_birth, nin, phone, email,
                 district_of_origin, guardian_name, guardian_phone,
                 programme_code, intake_year, registration_number, is_active, sponsorship_type)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
              [tenantId, first_name, last_name, otherNames || null,
               date_of_birth, nin, phone, email,
               district, nokName || null, nokPhone ? normalisePhone(nokPhone) : null,
               programme_code, intakeYear || null, rawRegNo || null, is_active, sponsorship]
            );
          }
        }
      } catch (err) {
        report.error(`Row ${i + 2}: ${full_name}`, err);
        if (VERBOSE) console.error(`    Error:`, err.message);
      }
    }
  });

  report.print();
  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
