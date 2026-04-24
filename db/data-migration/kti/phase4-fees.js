/**
 * kti/phase4-fees.js — Phase 4: Import KTI fee payment records
 *
 * Source: KASESE TECH INST GENERAL INFORMATION.xlsx, Sheet7 (fee records)
 *
 * Because fee records are linked by student name only (no reg number),
 * this script uses fuzzy name matching. All matches with score < 0.8 are
 * written to a review file for manual confirmation before committing.
 *
 * Usage:
 *   node db/data-migration/kti/phase4-fees.js [--dry-run] [--verbose] [--threshold=0.8]
 *
 * Output:
 *   db/data-migration/kti/phase4-review.json  — rows needing manual review
 */

const path = require('path');
const fs   = require('fs');
const { readXlsx } = require('../lib/xlsx');
const { matchStudent, excelDateToISO, titleCase } = require('../lib/normalise');
const { withTenant, getTenantId, end, query } = require('../lib/db');
const { Report } = require('../lib/report');

const DRY_RUN   = process.argv.includes('--dry-run');
const VERBOSE   = process.argv.includes('--verbose');
const threshArg = process.argv.find(a => a.startsWith('--threshold='));
const THRESHOLD = threshArg ? parseFloat(threshArg.split('=')[1]) : 0.8;

const XLSX_PATH    = path.resolve(__dirname, 'raw/KASESE TECH INST GENERAL INFORMATION.xlsx');
const REVIEW_PATH  = path.resolve(__dirname, 'phase4-review.json');

async function run() {
  const report = new Report('phase4-fees', 'kti');
  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');
  console.log(`Fuzzy match threshold: ${THRESHOLD}\n`);

  const tenantId = await getTenantId('kti');
  console.log(`Tenant ID: ${tenantId}\n`);

  // Build student name roster for fuzzy matching
  const { rows: students } = await query(
    `SELECT id, first_name || ' ' || last_name AS full_name FROM app.students WHERE tenant_id=$1`,
    [tenantId]
  );
  console.log(`Loaded ${students.length} students for name matching\n`);

  // Load fee sheet (Sheet7 = index 6)
  const sheets = readXlsx(XLSX_PATH);
  const feeSheet = sheets[6];
  if (!feeSheet) {
    console.error('Sheet7 not found — cannot import fees');
    process.exit(1);
  }
  console.log(`Fee sheet: "${feeSheet.sheetName}" — ${feeSheet.rows.length - 1} data rows\n`);

  const reviewRows = [];

  await withTenant(tenantId, async (client) => {
    for (let i = 1; i < feeSheet.rows.length; i++) {
      const row = feeSheet.rows[i];
      // A=0 student_name, B=1 amount, C=2 currency, D=3 receipt_number,
      // E=4 payment_date (serial), F=5 term, G=6 sponsorship, H=7 programme, I=8 fee_type
      const rawName      = (row[0] || '').trim();
      const rawAmount    = (row[1] || '').trim();
      const currency     = (row[2] || 'UGX').trim();
      const receiptNo    = (row[3] || '').trim();
      const rawDate      = (row[4] || '').trim();
      const term         = (row[5] || '').trim();
      const sponsorship  = (row[6] || '').trim();
      const programmeCode = (row[7] || '').trim();
      const feeType      = (row[8] || 'tuition').trim().toLowerCase();

      if (!rawName && !rawAmount) { report.skipped(`Row ${i + 1}: blank`); continue; }
      if (!rawName) { report.skipped(`Row ${i + 1}: no student name`); continue; }

      const amount = parseFloat(rawAmount.replace(/,/g, ''));
      if (isNaN(amount)) { report.skipped(`Row ${i + 1}: invalid amount "${rawAmount}"`); continue; }

      const paymentDate = excelDateToISO(parseFloat(rawDate));

      // Fuzzy match
      const match = matchStudent(rawName, students, THRESHOLD);

      if (!match) {
        report.skipped(`Row ${i + 1}: "${rawName}" — no match above threshold ${THRESHOLD}`);
        reviewRows.push({ row: i + 1, source_name: rawName, matched_name: null, score: 0, amount, currency, receipt_no: receiptNo, payment_date: paymentDate });
        if (VERBOSE) console.log(`  SKIP row ${i + 1}: "${rawName}" unmatched`);
        continue;
      }

      if (match.score < 1.0) {
        reviewRows.push({ row: i + 1, source_name: rawName, matched_name: match.full_name, student_id: match.id, score: match.score, amount, currency, receipt_no: receiptNo, payment_date: paymentDate });
        if (VERBOSE) console.log(`  LOW-CONF row ${i + 1}: "${rawName}" → "${match.full_name}" (score=${match.score.toFixed(2)})`);
      }

      try {
        // Check for duplicate by receipt number
        if (receiptNo) {
          const dup = await client.query(
            'SELECT id FROM app.payments WHERE tenant_id=$1 AND receipt_number=$2',
            [tenantId, receiptNo]
          );
          if (dup.rows.length > 0) {
            report.skipped(`Row ${i + 1}: duplicate receipt ${receiptNo}`);
            continue;
          }
        }

        if (!DRY_RUN) {
          const paidAt = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
          const payDate = paymentDate ? new Date(paymentDate).toISOString().slice(0, 10) : null;
          await client.query(
            `INSERT INTO app.payments
              (tenant_id, student_id, amount, currency,
               reference, receipt_number,
               paid_at, payment_date,
               term, sponsorship_type, programme_code, fee_type, match_confidence,
               source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'import')`,
            [tenantId, match.id, amount, currency,
             receiptNo || `import-${i}`,
             receiptNo || `import-${i}`,
             paidAt, payDate,
             term || null, sponsorship || null,
             programmeCode || null, feeType, match.score]
          );
        }
        report.inserted(`${rawName} → ${match.full_name} (${match.score.toFixed(2)})`);
      } catch (err) {
        report.error(`Row ${i + 1}: ${rawName}`, err);
        if (VERBOSE) console.error('  ERR:', err.message);
      }
    }
  });

  // Write review file
  if (reviewRows.length > 0) {
    fs.writeFileSync(REVIEW_PATH, JSON.stringify(reviewRows, null, 2));
    console.log(`\n⚠  ${reviewRows.length} rows written to ${REVIEW_PATH} for manual review.`);
    console.log('   Review and confirm student matches before finalising Phase 4.');
  }

  report.print();
  await end();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
