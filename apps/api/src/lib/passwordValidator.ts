/**
 * Password strength validator — shared across all auth endpoints (Prompt 19).
 *
 * Requirements: min 8 chars, at least 1 uppercase letter, at least 1 digit.
 */

export const PASSWORD_REQUIREMENTS =
  "Password must be at least 8 characters and contain at least one uppercase letter and one number.";

/**
 * Returns true if the password meets requirements:
 *   - ≥ 8 characters
 *   - contains at least one uppercase ASCII letter
 *   - contains at least one digit
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}
