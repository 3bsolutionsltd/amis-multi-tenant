/**
 * kti/phase6-ncbc-cohort.js — Phase 6: Import NCBC 2024/2025 UVTAB cohort students
 *
 * Source: Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx (Sheet1, rows 16–41)
 *
 * These 26 students are a PRIOR cohort (2024/2025 academic year) whose UVTAB
 * examination results appear in the CAD coursework sheet. They are NOT in the
 * main 2025/2026 student register (different individuals with similar surnames).
 *
 * Strategy:
 *   - Use the UVTAB reg number (UBT212/...) as both registration_number and
 *     uvtab_reg_number so phase3-marks.js can look them up by uvtab_reg_number.
 *   - is_active = false  (historical/graduated cohort)
 *   - intake_year = '2024/2025'
 *
 * Usage:
 *   node db/data-migration/kti/phase6-ncbc-cohort.js [--dry-run] [--verbose]
 */

'use strict';

const path = require('path');
const { readXlsx } = require('../lib/xlsx');
const { withTenant, getTenantId, end } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

const NCBC_XLSX = path.resolve(__dirname, 'raw/Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx');

function titleCase(str) {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function run() {
  const report = new Report('phase6-ncbc-cohort', 'kti');
  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');

  const tenantId = await getTenantId('kti');
  console.log(`Tenant ID: ${tenantId}\n`);

  const sheets = readXlsx(NCBC_XLSX);
  const sheet = sheets[0]; // Sheet1

  // Verify header row (row 15, 0-indexed)
  // R15: S/N | REGISTRATION NO. | SURNAME | OTHER NAMES | ...
  const headerRow = sheet.rows[15];
  console.log('Header row:', headerRow.slice(0, 5).join(' | '));

  // Data rows: 16–41 (0-indexed)
  // Col 0: S/N, Col 1: UVTAB reg, Col 2: SURNAME (+ other names), Col 3: OTHER NAMES
  const students = [];
  for (let i = 16; i <= 41 && i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    const uvtabReg = String(row[1] || '').trim();
    if (!uvtabReg || uvtabReg.length < 5) continue;

    const surnameCol  = String(row[2] || '').trim(); // e.g. "BWAMBALE DENIS IDEMBE"
    if (!surnameCol) continue;

    // Parse: first token = surname, rest = first_name (other names)
    const nameParts = surnameCol.split(/\s+/);
    const lastName  = titleCase(nameParts[0]);
    const firstName = titleCase(nameParts.slice(1).join(' ')) || 'Unknown';

    students.push({ uvtabReg, lastName, firstName });
  }

  console.log(`Found ${students.length} student rows in CAD sheet\n`);

  await withTenant(tenantId, async (client) => {
    for (const s of students) {
      // Idempotency: skip if already imported (match by uvtab_reg_number)
      const existing = await client.query(
        `SELECT id FROM app.students WHERE tenant_id=$1 AND uvtab_reg_number=$2`,
        [tenantId, s.uvtabReg]
      );
      if (existing.rows.length > 0) {
        report.skipped(`${s.lastName} ${s.firstName} (${s.uvtabReg}) — already exists`);
        continue;
      }

      if (VERBOSE) console.log(`  INSERT ${s.lastName} ${s.firstName} — ${s.uvtabReg}`);

      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name,
              registration_number, uvtab_reg_number,
              programme_code, intake_year, is_active)
           VALUES ($1,$2,$3,$4,$5,'NCBC','2024/2025',false)`,
          [tenantId, s.firstName, s.lastName, s.uvtabReg, s.uvtabReg]
        );
      }
      report.inserted(`${s.lastName} ${s.firstName} (${s.uvtabReg})`);
    }
  });

  report.print();
  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
