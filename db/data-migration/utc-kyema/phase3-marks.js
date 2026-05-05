/**
 * utc-kyema/phase3-marks.js — Phase 3: Import UTC Kyema marks/results
 *
 * STATUS: AWAITING SOURCE DATA
 *   UTC Kyema must provide per-course result sheets as Excel or CSV.
 *   Place the file at: db/data-migration/utc-kyema/raw/marks.xlsx
 *
 * Once the file is available:
 *   1. Audit the sheet structure and update COLUMN_MAP + SHEET_CONFIG below
 *   2. Run: node db/data-migration/utc-kyema/phase3-marks.js [--dry-run]
 *
 * Expected structure (one sheet per course OR columns per course):
 *   - Student identifier (name or admission number)
 *   - Programme / course code
 *   - Term / year
 *   - CA score (continuous assessment)
 *   - Exam score
 *   - Final score (CA + Exam)
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 *           phase1-seed.js and phase2-students.js must have run first
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { end } = require('../lib/db');

const SOURCE_FILE = path.join(__dirname, 'raw', 'marks.xlsx');

async function run() {
  // Guard: source file must exist
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`\nSOURCE FILE NOT FOUND: ${SOURCE_FILE}`);
    console.error('Place the UTC Kyema marks/results Excel file at:');
    console.error(`  ${SOURCE_FILE}`);
    console.error('\nThis phase is blocked until UTC Kyema provides the file.\n');
    await end();
    process.exit(1);
  }

  // TODO: Implement once source file is reviewed.
  // Pattern to follow: see db/data-migration/kti/phase3-marks.js
  console.error('phase3-marks.js: implementation pending source file review.');
  await end();
  process.exit(1);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
