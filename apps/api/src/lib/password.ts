/**
 * Password hashing utilities using Node.js built-in crypto (no external deps).
 *
 * Algorithm: scrypt (OWASP-recommended for password hashing)
 * Parameters: N=16384 (2^14), r=8, p=1, keylen=64 — appropriate for a pilot server.
 *
 * Stored format: "<salt_hex>:<dk_hex>"  (32-byte salt + 64-byte derived key)
 */

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SCRYPT_N = 16384; // cost factor
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelism
const KEY_LEN = 64; // derived key length in bytes
const SALT_LEN = 32; // random salt length in bytes

/**
 * Hash a plaintext password (sync — only use in seeds/tests, not request handlers).
 * Returns a storable string in the format "<salt_hex>:<dk_hex>".
 */
export function hashPassword(plaintext: string): string {
  const salt = randomBytes(SALT_LEN);
  const dk = scryptSync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}

/**
 * Hash a plaintext password asynchronously — use this in request handlers.
 */
export async function hashPasswordAsync(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const dk = (await scryptAsync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(plaintext: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, dkHex] = parts;
  let salt: Buffer;
  let expectedDk: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expectedDk = Buffer.from(dkHex, "hex");
  } catch {
    return false;
  }

  if (salt.length !== SALT_LEN || expectedDk.length !== KEY_LEN) return false;

  const actualDk = scryptSync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return timingSafeEqual(actualDk, expectedDk);
}

/**
 * Verify a plaintext password asynchronously — use this in request handlers.
 */
export async function verifyPasswordAsync(
  plaintext: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, dkHex] = parts;
  let salt: Buffer;
  let expectedDk: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expectedDk = Buffer.from(dkHex, "hex");
  } catch {
    return false;
  }

  if (salt.length !== SALT_LEN || expectedDk.length !== KEY_LEN) return false;

  const actualDk = (await scryptAsync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;

  return timingSafeEqual(actualDk, expectedDk);
}
