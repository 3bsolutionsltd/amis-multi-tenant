/**
 * kti/phase3-marks.js — Phase 3: Import KTI marks / coursework
 *
 * Sources:
 *   1. Sheet5 of KASESE TECH INST GENERAL INFORMATION.xlsx (56 general marks rows)
 *   2. Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx (26 UVTAB NCBC CAD rows)
 *
 * Usage:
 *   node db/data-migration/kti/phase3-marks.js [--dry-run] [--verbose]
 */

const path = require('path');
const { readXlsx } = require('../lib/xlsx');
const { withTenant, getTenantId, end, query } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

const GENERAL_XLSX = path.resolve(__dirname, 'raw/KASESE TECH INST GENERAL INFORMATION.xlsx');
const NCBC_XLSX    = path.resolve(__dirname, 'raw/Copy of NCBC 11 COMPUTER AIDED DESIGN.xlsx');

async function run() {
  const report = new Report('phase3-marks', 'kti');
  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');

  const tenantId = await getTenantId('kti');
  console.log(`Tenant ID: ${tenantId}\n`);

  // Build student lookup: registration_number → student UUID
  const { rows: students } = await query(
    'SELECT id, registration_number, uvtab_reg_number, first_name || \' \' || last_name AS full_name FROM app.students WHERE tenant_id=$1',
    [tenantId]
  );
  const byRegNo     = new Map(students.filter(s => s.registration_number).map(s => [s.registration_number, s]));
  const byUvtabNo   = new Map(students.filter(s => s.uvtab_reg_number).map(s => [s.uvtab_reg_number, s]));

  // Normalised lookup: strip prefix (e.g. "UVT212/") from DB reg_no → student
  // Also handles marks-sheet format "U/25/M/NCES/0302-UBT212" → normalise to "U/25/M/NCES/0302"
  const byNormRegNo = new Map();
  for (const s of students) {
    if (!s.registration_number) continue;
    // DB format: "UVT212/U/25/M/..." — strip leading segment up to first slash
    const stripped = s.registration_number.replace(/^[^/]+\//, '');
    byNormRegNo.set(stripped, s);
    byNormRegNo.set(s.registration_number, s); // also keep original
  }
  function lookupStudent(rawRegNo) {
    if (!rawRegNo) return null;
    // Try exact match first
    let s = byRegNo.get(rawRegNo);
    if (s) return s;
    // Strip trailing "-XXXX" suffix from marks-sheet format
    const base = rawRegNo.replace(/-[^-]+$/, '');
    s = byNormRegNo.get(base);
    if (s) return s;
    // Try with uvtab
    s = byUvtabNo.get(rawRegNo);
    return s || null;
  }
  console.log(`Student lookup: ${byRegNo.size} by reg_number, ${byUvtabNo.size} by uvtab_reg_number`);

  await withTenant(tenantId, async (client) => {
    // Cache of mark_submission IDs keyed by "course|programme|year|term"
    const submissionCache = new Map();

    // ── Source 1: General workbook Sheet5 ───────────────────────────────────
    console.log('\nLoading general marks (Sheet5)...');
    const genSheets = readXlsx(GENERAL_XLSX);
    const marksSheet = genSheets[4]; // Sheet5 = index 4

    if (marksSheet) {
      console.log(`  Sheet: "${marksSheet.sheetName}" — ${marksSheet.rows.length - 1} rows`);
      for (let i = 1; i < marksSheet.rows.length; i++) {
        const row = marksSheet.rows[i];
        // A=0 reg_no, B=1 name, C=2?, D=3 course_code, E=4 programme, F=5 year,
        // G=6 term, H=7 acad_year, I=8 score, J=9 max_score, K=10 assessment_type,
        // L=11 grade, M=12 remarks
        const rawRegNo       = (row[0] || '').trim();
        const courseCode     = (row[3] || '').trim();
        const programmeCode  = (row[4] || '').trim();
        const yearOfStudy    = parseInt(row[5] || '0') || null;
        const term           = (row[6] || '').trim();
        const academicYear   = (row[7] || '').trim();
        const score          = parseFloat(row[8] || '');
        const maxScore       = parseFloat(row[9] || '');
        const assessmentType = (row[10] || 'coursework').trim().toLowerCase();
        const remarks        = (row[12] || '').trim();

        if (!rawRegNo && !courseCode) { report.skipped(`Sheet5 row ${i + 1}: blank`); continue; }
        if (!courseCode) { report.skipped(`Sheet5 row ${i + 1}: no course code`); continue; }
        if (isNaN(score)) { report.skipped(`Sheet5 row ${i + 1}: no score`); continue; }

        const student = lookupStudent(rawRegNo);
        if (!student) {
          report.skipped(`Sheet5 row ${i + 1}: student not found for reg_no=${rawRegNo}`);
          if (VERBOSE) console.log(`  SKIP row ${i + 1}: unknown reg_no ${rawRegNo}`);
          continue;
        }

        try {
          // Find or create a mark_submission for this course+programme+term+year
          const subKey = `${courseCode}|${programmeCode}|${academicYear}|${term}`;
          if (!submissionCache.has(subKey)) {
            const existing = await client.query(
              `SELECT id FROM app.mark_submissions WHERE tenant_id=$1 AND course_id=$2 AND programme=$3 AND intake=$4 AND term=$5`,
              [tenantId, courseCode, programmeCode || '', academicYear || '', term || '']
            );
            let subId;
            if (existing.rows.length > 0) {
              subId = existing.rows[0].id;
            } else if (!DRY_RUN) {
              const res = await client.query(
                `INSERT INTO app.mark_submissions (tenant_id, course_id, programme, intake, term)
                 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                [tenantId, courseCode, programmeCode || '', academicYear || '', term || '']
              );
              subId = res.rows[0].id;
            } else {
              subId = `dry-run-${subKey}`;
            }
            submissionCache.set(subKey, subId);
          }
          const submissionId = submissionCache.get(subKey);

          if (DRY_RUN) {
            report.inserted(`${student.full_name} / ${courseCode}`);
          } else {
            const existing = await client.query(
              `SELECT id FROM app.mark_entries WHERE submission_id=$1 AND student_id=$2`,
              [submissionId, student.id]
            );
            if (existing.rows.length > 0) {
              report.updated(`${student.full_name} / ${courseCode}`);
            } else {
              await client.query(
                `INSERT INTO app.mark_entries (tenant_id, submission_id, student_id, score)
                 VALUES ($1,$2,$3,$4)`,
                [tenantId, submissionId, student.id, isFinite(score) ? score : 0]
              );
              report.inserted(`${student.full_name} / ${courseCode}`);
            }
          }
        } catch (err) {
          report.error(`Sheet5 row ${i + 1}`, err);
          if (VERBOSE) console.error('  ERR:', err.message);
        }
      }
    } else {
      console.warn('  WARNING: Sheet5 not found — skipping general marks');
    }

    // ── Source 2: NCBC CAD UVTAB submission ─────────────────────────────────
    console.log('\nLoading NCBC CAD marks...');
    const ncbcSheets = readXlsx(NCBC_XLSX);
    // Find the submission sheet (usually sheet1/2 in this workbook)
    const ncbcSheet = ncbcSheets[0];
    if (!ncbcSheet) {
      console.warn('  WARNING: NCBC workbook is empty');
    } else {
      // Student data starts at row 15 (0-indexed: 14), ends when B column is blank
      // B=1 uvtab_reg, C=2 surname, D=3 other_names
      // E=4 assign1(5%), F=5 assign2(5%), G=6(10%), H=7 assign3(10%), J=9 assign4(25%), K=10 internal(80%), L=11 final%
      const COURSE_CODE    = 'NCBC11-CAD';
      const ACADEMIC_YEAR  = '2024/2025';
      const YEAR_OF_STUDY  = 2;
      const PROGRAMME_CODE = 'NCBC';

      let studentRows = 0;
      for (let i = 14; i < ncbcSheet.rows.length; i++) {
        const row = ncbcSheet.rows[i];
        const uvtabRegNo = (row[1] || '').trim();
        if (!uvtabRegNo || uvtabRegNo.length < 5) continue;

        const finalScore = parseFloat(row[11] || row[10] || '');
        if (isNaN(finalScore)) continue;

        studentRows++;
        const student = byUvtabNo.get(uvtabRegNo);
        if (!student) {
          report.skipped(`NCBC row ${i + 1}: uvtab_reg_no=${uvtabRegNo} not matched`);
          if (VERBOSE) console.log(`  SKIP NCBC row ${i + 1}: ${uvtabRegNo} not in students`);
          continue;
        }

        try {
          const subKey = `${COURSE_CODE}|${PROGRAMME_CODE}|${ACADEMIC_YEAR}|`;
          if (!submissionCache.has(subKey)) {
            const existing = await client.query(
              `SELECT id FROM app.mark_submissions WHERE tenant_id=$1 AND course_id=$2 AND programme=$3 AND intake=$4`,
              [tenantId, COURSE_CODE, PROGRAMME_CODE, ACADEMIC_YEAR]
            );
            let subId;
            if (existing.rows.length > 0) {
              subId = existing.rows[0].id;
            } else if (!DRY_RUN) {
              const res = await client.query(
                `INSERT INTO app.mark_submissions (tenant_id, course_id, programme, intake, term)
                 VALUES ($1,$2,$3,$4,'Full Year') RETURNING id`,
                [tenantId, COURSE_CODE, PROGRAMME_CODE, ACADEMIC_YEAR]
              );
              subId = res.rows[0].id;
            } else {
              subId = `dry-run-ncbc-cad`;
            }
            submissionCache.set(subKey, subId);
          }
          const submissionId = submissionCache.get(subKey);

          if (DRY_RUN) {
            report.inserted(`${student.full_name} / ${COURSE_CODE} (UVTAB)`);
          } else {
            const existing = await client.query(
              `SELECT id FROM app.mark_entries WHERE submission_id=$1 AND student_id=$2`,
              [submissionId, student.id]
            );
            if (existing.rows.length > 0) {
              report.updated(`${student.full_name} / ${COURSE_CODE}`);
            } else {
              await client.query(
                `INSERT INTO app.mark_entries (tenant_id, submission_id, student_id, score)
                 VALUES ($1,$2,$3,$4)`,
                [tenantId, submissionId, student.id, finalScore]
              );
              report.inserted(`${student.full_name} / ${COURSE_CODE} (UVTAB)`);
            }
          }
        } catch (err) {
          report.error(`NCBC row ${i + 1}`, err);
        }
      }
      console.log(`  Processed ${studentRows} NCBC student rows`);
    }
  });

  report.print();
  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
