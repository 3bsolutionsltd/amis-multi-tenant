/**
 * utc-kyema/phase4-fees.js — Phase 4: Import UTC Kyema fee payment records
 *
 * STATUS: AWAITING SOURCE DATA
 *   UTC Kyema must provide the fee payment register as Excel or CSV.
 *   Place the file at: db/data-migration/utc-kyema/raw/fees.xlsx
 *
 * Once the file is available:
 *   1. Audit the sheet structure and update COLUMN_MAP below
 *   2. Run: node db/data-migration/utc-kyema/phase4-fees.js [--dry-run]
 *
 * Expected columns:
 *   - Student identifier (name or admission number)
 *   - Term / year
 *   - Amount paid
 *   - Date of payment
 *   - Receipt number (optional)
 *
 * Requires: DATABASE_URL in environment or .env at repo root
 *           phase1-seed.js and phase2-students.js must have run first
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { end } = require('../lib/db');

const SOURCE_FILE = path.join(__dirname, 'raw', 'fees.xlsx');

async function run() {
  // Guard: source file must exist
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`\nSOURCE FILE NOT FOUND: ${SOURCE_FILE}`);
    console.error('Place the UTC Kyema fee register Excel file at:');
    console.error(`  ${SOURCE_FILE}`);
    console.error('\nThis phase is blocked until UTC Kyema provides the file.\n');
    await end();
    process.exit(1);
  }

  // TODO: Implement once source file is reviewed.
  // Pattern to follow: see db/data-migration/kti/phase4-fees.js
  console.error('phase4-fees.js: implementation pending source file review.');
  await end();
  process.exit(1);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  end().then(() => process.exit(1));
});
