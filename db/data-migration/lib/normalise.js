/**
 * normalise.js — Data cleaning utilities shared across all VTI importers.
 */

/**
 * Parse a "SURNAME Firstname" or "Firstname SURNAME" name string.
 * Strategy: if lastName is empty, split firstName by space and treat first token as surname.
 * @returns {{ first_name: string, last_name: string }}
 */
function parseName(rawFirst, rawLast) {
  const first = (rawFirst || '').trim();
  const last = (rawLast || '').trim();

  if (last.length > 0) {
    return { first_name: titleCase(first), last_name: titleCase(last) };
  }

  // last name is blank — split first by whitespace
  const parts = first.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: titleCase(first), last_name: '' };
  }
  return {
    last_name: titleCase(parts[0]),
    first_name: titleCase(parts.slice(1).join(' ')),
  };
}

/** Build full_name from parsed parts */
function fullName(first_name, last_name) {
  return [last_name, first_name].filter(Boolean).join(' ');
}

/** Normalise to title case */
function titleCase(str) {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Normalise a phone number to +256XXXXXXXXX format.
 * Accepts: 0XXXXXXXXX, 256XXXXXXXXX, +256XXXXXXXXX
 */
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('256') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 10) return '+256' + digits.slice(1);
  if (digits.length === 9) return '+256' + digits; // assume Uganda local without leading 0
  return digits.length > 0 ? '+' + digits : null; // fallback — return as-is with +
}

/**
 * Convert an Excel date serial to ISO date string (YYYY-MM-DD).
 * Excel epoch: 1 Jan 1900 = serial 1 (with Lotus 1900 leap-year bug).
 */
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const n = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (!isFinite(n) || n < 1) return null;
  const date = new Date((n - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Normalise gender string to 'male' | 'female' | 'other' | null.
 */
function normaliseGender(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (['m', 'male'].includes(v)) return 'male';
  if (['f', 'female'].includes(v)) return 'female';
  if (v.length > 0) return 'other';
  return null;
}

/**
 * Fuzzy name match score between two full-name strings.
 * Returns 0–1 where 1 = exact match.
 */
function fuzzyNameScore(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1;
  // Token overlap
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const overlap = [...ta].filter(t => tb.has(t)).length;
  const total = new Set([...ta, ...tb]).size;
  return overlap / total;
}

/**
 * Find the best matching student for a name string from a roster.
 * @param {string} name
 * @param {{ id: string, full_name: string }[]} roster
 * @param {number} threshold  Minimum score to accept (default 0.5)
 * @returns {{ id: string, full_name: string, score: number } | null}
 */
function matchStudent(name, roster, threshold = 0.5) {
  let best = null, bestScore = 0;
  for (const s of roster) {
    const score = fuzzyNameScore(name, s.full_name);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (best && bestScore >= threshold) return { ...best, score: bestScore };
  return null;
}

module.exports = {
  parseName,
  fullName,
  titleCase,
  normalisePhone,
  excelDateToISO,
  normaliseGender,
  fuzzyNameScore,
  matchStudent,
};
