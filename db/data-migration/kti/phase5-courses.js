/**
 * kti/phase5-courses.js — Phase 5: Import KTI course catalogue
 *
 * Source: KASESE TECH INST GENERAL INFORMATION.xlsx, Sheet3 "COURSE PROGRAMME"
 *         (sheet index 2 — all 5 programmes: NCAP, NCES, NCAM, NCPL, NCBC)
 *
 * Logic:
 *   - Detect programme from course code prefix (VCAP→NCAP, NCES→NCES, etc.)
 *   - TC* shared modules inherit the current programme context
 *   - Normalise codes: remove internal spaces ("VCAP 111" → "VCAP111")
 *   - Infer course_type from title suffix: (THEORY)→theory, (PRACT*)→practical,
 *     (REAL LIFE*) / (FARM ATTACH*) / (REAL LIF*) → practical, else → both
 *   - Upsert by (tenant_id, code): ON CONFLICT DO NOTHING (shared TC* inserted once)
 *
 * Usage:
 *   node db/data-migration/kti/phase5-courses.js [--dry-run] [--verbose]
 */

'use strict';

const path = require('path');
const { readXlsx } = require('../lib/xlsx');
const { withTenant, getTenantId, end, query } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

const XLSX_PATH = path.resolve(__dirname, 'raw/KASESE TECH INST GENERAL INFORMATION.xlsx');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise code: strip internal spaces, uppercase. "VCAP 111" → "VCAP111" */
function normCode(raw) {
  return (raw || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Derive programme code from course code prefix.
 * Returns 'NCAP'|'NCES'|'NCAM'|'NCPL'|'NCBC'|null (null = shared TC* or unknown).
 */
function progFromCode(code) {
  if (/^V?CAP/i.test(code) || /^VCAP/i.test(code)) return 'NCAP';
  if (/^NCES/i.test(code)) return 'NCES';
  if (/^NCAM/i.test(code)) return 'NCAM';
  if (/^NCPL/i.test(code)) return 'NCPL';
  if (/^NCBC/i.test(code)) return 'NCBC';
  return null; // shared TC* etc.
}

/**
 * Infer course_type from title.
 * Values accepted by DB: 'theory' | 'practical' | 'both'
 */
function inferCourseType(title) {
  const u = title.toUpperCase();
  if (u.includes('(THEORY)') || u.endsWith(' THEORY') || u.includes(' THEORY ')) return 'theory';
  if (u.includes('(PRACT') || u.endsWith(' PRACTICE') || u.endsWith(' PRACTICAL')
    || u.includes('REAL LIFE') || u.includes('REAL LIF')
    || u.includes('FARM ATTACH') || u.includes('FARM ATTACHMENT')
    || u.includes('INDUSTRIAL TRAINING')) return 'practical';
  return 'both';
}

/** Clean a numeric string like "1" or "" → integer or null */
function toInt(val) {
  const n = parseInt(val || '', 10);
  return isNaN(n) ? null : n;
}

/** Is this row a header/section row (no real course data)? */
function isHeaderRow(code, title) {
  if (!code && !title) return true;
  const c = code.toUpperCase();
  const t = title.toUpperCase();
  if (c === 'COURSE CODE' || c === 'COURSE CODE ' || c === 'CODE') return true;
  if (t.includes('DEPARTMENT') && t.includes('PROGRAMME')) return true;
  if (t === 'COURSE NAME' || t === 'COURSE NAME ') return true;
  if (/^SEMESTER|^YEAR|^YR /.test(t)) return true;
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const report = new Report('phase5-courses', 'kti');
  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');

  const tenantId = await getTenantId('kti');
  console.log(`Tenant ID: ${tenantId}\n`);

  // Build programme slug → UUID lookup
  const { rows: programmes } = await query(
    'SELECT id, code FROM app.programmes WHERE tenant_id=$1',
    [tenantId]
  );
  const progMap = new Map(programmes.map(p => [p.code.toUpperCase(), p.id]));
  console.log(`Found ${programmes.length} programmes: ${[...progMap.keys()].join(', ')}\n`);

  if (progMap.size === 0) {
    console.error('ERROR: No programmes found. Run phase1-seed.js first.');
    process.exit(1);
  }

  // Load course sheet (index 2 = "COURSE PROGRAMME", sheetId 3)
  const sheets = readXlsx(XLSX_PATH);
  const courseSheet = sheets[2];
  if (!courseSheet) {
    console.error('Sheet "COURSE PROGRAMME" not found at index 2');
    process.exit(1);
  }
  console.log(`Sheet: "${courseSheet.sheetName}" — ${courseSheet.rows.length - 1} data rows\n`);

  const rows = courseSheet.rows;
  let currentProg = 'NCAP'; // default to first section

  await withTenant(tenantId, async (client) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Col A=0 title, B=1 code, C=2 programme, D=3 year, E=4 semester, F=5 credits
      const rawTitle  = (row[0] || '').trim();
      const rawCode   = (row[1] || '').trim();
      const rawYear   = (row[3] || '').trim();
      const rawSem    = (row[4] || '').trim();
      const rawCredit = (row[5] || '').trim();

      if (!rawTitle && !rawCode) continue;

      const normalisedCode = normCode(rawCode);

      // Detect new programme section from the raw code col (header rows have "Course Code" etc.)
      if (isHeaderRow(normalisedCode, rawTitle)) {
        // Detect programme change from large title rows like "AGRICULTURE DEPARTMENT COURSE PROGRAMME"
        const u = rawTitle.toUpperCase();
        if (u.includes('AGRICULTURE')) currentProg = 'NCAP';
        else if (u.includes('ELECTRIC')) currentProg = 'NCES';
        else if (u.includes('AUTOMO')) currentProg = 'NCAM';
        else if (u.includes('PLUMB')) currentProg = 'NCPL';
        else if (u.includes('BRICK') || u.includes('BUILDING') || u.includes('CONSTRUCTION')) currentProg = 'NCBC';
        if (VERBOSE) console.log(`  [${i}] Section header → prog=${currentProg}: ${rawTitle.substring(0, 60)}`);
        continue;
      }

      if (!normalisedCode) continue; // title-only rows (sub-headers like "SEMESTER I")

      // Determine which programme this course belongs to
      const detectedProg = progFromCode(normalisedCode);
      if (detectedProg) currentProg = detectedProg;
      // else: TC* shared module — use currentProg

      const programmeId = progMap.get(currentProg);
      if (!programmeId) {
        report.skipped(`Code ${normalisedCode}: programme ${currentProg} not in DB`);
        if (VERBOSE) console.log(`  SKIP: no programme_id for ${currentProg}`);
        continue;
      }

      const courseType  = inferCourseType(rawTitle);
      const yearOfStudy = toInt(rawYear) || 1;
      const semester    = toInt(rawSem) || 1;
      const creditHours = toInt(rawCredit) || 3;

      // Clean title: remove leading numbering like "1. " or "12. "
      const cleanTitle = rawTitle.replace(/^\d+\.\s*/, '').trim();

      try {
        const existing = await client.query(
          'SELECT id FROM app.courses WHERE tenant_id=$1 AND code=$2',
          [tenantId, normalisedCode]
        );

        if (existing.rows.length > 0) {
          report.skipped(`${normalisedCode} already exists`);
          if (VERBOSE) console.log(`  SKIP: ${normalisedCode} exists`);
          continue;
        }

        if (!DRY_RUN) {
          await client.query(
            `INSERT INTO app.courses
               (tenant_id, programme_id, code, title, credit_hours, course_type, year_of_study, semester)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [tenantId, programmeId, normalisedCode, cleanTitle, creditHours, courseType, yearOfStudy, semester]
          );
        }
        report.inserted(`${normalisedCode} — ${cleanTitle.substring(0, 45)} [${currentProg} Y${yearOfStudy}S${semester} ${courseType}]`);
        if (VERBOSE) console.log(`  INS: ${normalisedCode} — ${cleanTitle.substring(0, 45)}`);
      } catch (err) {
        report.error(`Row ${i + 1} code=${normalisedCode}`, err);
        if (VERBOSE) console.error('  ERR:', err.message);
      }
    }
  });

  report.print();
  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
