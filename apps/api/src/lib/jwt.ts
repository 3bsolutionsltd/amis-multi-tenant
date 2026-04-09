/**
 * JWT utilities — Prompt 17
 *
 * Uses the `jsonwebtoken` package directly (no Fastify plugin decorators)
 * so that auth logic is fully testable without a Fastify context.
 *
 * JWT_SECRET is read lazily on every call so that the module can be imported
 * before process.env is populated (e.g. in test environments where .env is
 * loaded by test-setup.ts before the first test runs).
 *
 * Call assertJwtConfig() once at server startup to fail fast if the secret
 * is missing, rather than waiting for the first auth request.
 */
import jwt from "jsonwebtoken";

export interface JwtPayload {
  /** User ID (platform.users.id) */
  sub: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error(
      "[auth] JWT_SECRET environment variable is required. " +
        "Add it to .env before starting the server.",
    );
  }
  return s;
}

/**
 * Validate that JWT_SECRET is configured.
 * Call once in the server entry-point so misconfiguration is caught at startup.
 */
export function assertJwtConfig(): void {
  getSecret();
}

/**
 * Sign a JWT access token.
 * Expiry: 15 minutes.
 */
export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "15m" });
}

/**
 * Verify and decode a JWT access token.
 * Throws `JsonWebTokenError` or `TokenExpiredError` if invalid / expired.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
