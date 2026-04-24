/**
 * report.js — Migration run reporter.
 * Accumulates counts and detail rows; prints a summary at the end.
 */

class Report {
  constructor(phase, tenant) {
    this.phase = phase;
    this.tenant = tenant;
    this.counts = { inserted: 0, updated: 0, skipped: 0, errored: 0 };
    this.errors = [];
    this.warnings = [];
    this.startedAt = Date.now();
  }

  inserted(detail) { this.counts.inserted++; if (detail) process.stdout.write('.'); }
  updated(detail)  { this.counts.updated++;  if (detail) process.stdout.write('u'); }
  skipped(detail)  { this.counts.skipped++;  this.warnings.push(detail); }
  error(row, err)  {
    this.counts.errored++;
    this.errors.push({ row, message: err.message || String(err) });
  }

  print() {
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    console.log('\n');
    console.log(`=== Migration Report [${this.phase}] tenant=${this.tenant} (${elapsed}s) ===`);
    console.log(`  Inserted : ${this.counts.inserted}`);
    console.log(`  Updated  : ${this.counts.updated}`);
    console.log(`  Skipped  : ${this.counts.skipped}`);
    console.log(`  Errors   : ${this.counts.errored}`);

    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const w of this.warnings.slice(0, 20)) console.log('  SKIP:', w);
      if (this.warnings.length > 20) console.log(`  ... and ${this.warnings.length - 20} more`);
    }

    if (this.errors.length > 0) {
      console.log('\nErrors:');
      for (const e of this.errors.slice(0, 20)) console.log('  ERR:', e.row, '-', e.message);
      if (this.errors.length > 20) console.log(`  ... and ${this.errors.length - 20} more`);
    }

    if (this.counts.errored > 0) process.exitCode = 1;
  }
}

module.exports = { Report };
