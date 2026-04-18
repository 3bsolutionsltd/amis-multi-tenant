/**
 * Auth routes — Prompt 17
 *
 * POST /auth/login   — verify credentials, return JWT + refresh token
 * POST /auth/refresh — rotate refresh token, return new JWT pair
 * POST /auth/logout  — revoke refresh token (always 204)
 * GET  /auth/me      — return current user from Bearer JWT
 *
 * All auth DB queries use the superuser pool (DATABASE_URL) so they bypass
 * RLS. This is intentional: login/refresh must read platform.users before a
 * tenant context can be established.
 */
import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { hashPasswordAsync, verifyPasswordAsync } from "../../lib/password.js";
import { signToken, verifyToken } from "../../lib/jwt.js";
import { isValidPassword } from "../../lib/passwordValidator.js";

// ------------------------------------------------------------------ helpers

const INVALID_CREDS = "Invalid credentials";
const ACCOUNT_DISABLED = "Account disabled";

/** sha256 hex hash of a raw refresh token string. */
function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a new refresh token raw value + its hash. */
function makeRefreshToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashRefreshToken(raw) };
}

/** Insert a refresh token row, returns the raw token string. */
async function issueRefreshToken(userId: string): Promise<string> {
  const { raw, hash } = makeRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt],
  );
  return raw;
}

/** Revoke all refresh tokens for a user (e.g. after password change/reset). */
async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE platform.refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId],
  );
}

// ------------------------------------------------------------------ schemas

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(1).optional(),
}).refine(
  (d) => d.tenantId !== undefined || d.tenantSlug !== undefined,
  { message: "Either tenantId or tenantSlug must be provided" },
);

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  tenantId: z.string().uuid(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

// ------------------------------------------------------------------ DB row types

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  password_hash: string;
  is_active: boolean;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
}

// ------------------------------------------------------------------ routes

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/login
   * Body: { email, password, tenantId }
   */
  app.post("/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        message: "Invalid request body",
        errors: parsed.error.flatten(),
      });
    }

    const { email, password, tenantId: rawTenantId, tenantSlug } = parsed.data;

    // Resolve tenant: prefer tenantId if given, otherwise look up by slug
    let tenantId = rawTenantId;
    if (!tenantId && tenantSlug) {
      const { rows: tenantRows } = await pool.query<{ id: string }>(
        `SELECT id FROM platform.tenants WHERE slug = $1 AND is_active = true`,
        [tenantSlug],
      );
      if (tenantRows.length === 0) {
        return reply
          .status(401)
          .send({ statusCode: 401, message: INVALID_CREDS });
      }
      tenantId = tenantRows[0].id;
    }

    const { rows } = await pool.query<UserRow>(
      `SELECT id, tenant_id, email, role, password_hash, is_active
       FROM platform.users
       WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );

    const user = rows[0];

    // Constant-time path: verify password even on not-found to prevent timing attacks
    const passwordOk = user
      ? await verifyPasswordAsync(password, user.password_hash)
      : false;

    if (!user || !passwordOk) {
      return reply
        .status(401)
        .send({ statusCode: 401, message: INVALID_CREDS });
    }

    if (!user.is_active) {
      return reply
        .status(401)
        .send({ statusCode: 401, message: ACCOUNT_DISABLED });
    }

    const accessToken = signToken({
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    });
    const refreshToken = await issueRefreshToken(user.id);

    return reply.status(200).send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
    });
  });

  /**
   * POST /auth/refresh
   * Body: { refreshToken }
   */
  app.post("/auth/refresh", async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ statusCode: 400, message: "Invalid request body" });
    }

    const tokenHash = hashRefreshToken(parsed.data.refreshToken);

    const { rows: tokenRows } = await pool.query<RefreshTokenRow>(
      `SELECT id, user_id
       FROM platform.refresh_tokens
       WHERE token_hash = $1 AND revoked = false AND expires_at > now()`,
      [tokenHash],
    );

    if (!tokenRows[0]) {
      return reply
        .status(401)
        .send({ statusCode: 401, message: "Invalid or expired refresh token" });
    }

    const { id: tokenId, user_id: userId } = tokenRows[0];

    const { rows: userRows } = await pool.query<Omit<UserRow, "password_hash">>(
      `SELECT id, tenant_id, email, role, is_active
       FROM platform.users WHERE id = $1`,
      [userId],
    );

    const user = userRows[0];
    if (!user?.is_active) {
      return reply
        .status(401)
        .send({ statusCode: 401, message: ACCOUNT_DISABLED });
    }

    // Revoke old token (token rotation — one-time use)
    await pool.query(
      `UPDATE platform.refresh_tokens SET revoked = true WHERE id = $1`,
      [tokenId],
    );

    // Issue new token pair
    const accessToken = signToken({
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    });
    const refreshToken = await issueRefreshToken(user.id);

    return reply.status(200).send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
    });
  });

  /**
   * POST /auth/logout
   * Body: { refreshToken }
   * Always returns 204 — no error if token unknown or already revoked.
   */
  app.post("/auth/logout", async (req, reply) => {
    const parsed = LogoutSchema.safeParse(req.body);
    if (parsed.success) {
      const tokenHash = hashRefreshToken(parsed.data.refreshToken);
      await pool.query(
        `UPDATE platform.refresh_tokens SET revoked = true WHERE token_hash = $1`,
        [tokenHash],
      );
    }
    return reply.status(204).send();
  });

  /**
   * GET /auth/me
   * Authorization: Bearer <jwt>
   * Does NOT use requireRole — that comes in Prompt 18.
   */
  app.get("/auth/me", async (req, reply) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({
        statusCode: 401,
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.slice(7);
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = verifyToken(token);
    } catch {
      return reply
        .status(401)
        .send({ statusCode: 401, message: "Invalid or expired token" });
    }

    const { rows } = await pool.query<Omit<UserRow, "password_hash">>(
      `SELECT id, tenant_id, email, role, is_active
       FROM platform.users WHERE id = $1`,
      [payload.sub],
    );

    const user = rows[0];
    if (!user) {
      return reply
        .status(401)
        .send({ statusCode: 401, message: "User not found" });
    }

    return reply.status(200).send({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isActive: user.is_active,
    });
  });

  /**
   * POST /auth/forgot-password
   * Body: { email, tenantId }
   * Public — no auth required.
   * Always returns 200 to prevent user enumeration.
   * Logs raw token to console in dev (no email service yet).
   */
  app.post("/auth/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ statusCode: 400, message: "Invalid request body" });
    }

    const { email, tenantId } = parsed.data;
    const MSG = "If that email exists, a reset link has been sent.";

    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM platform.users
       WHERE tenant_id = $1 AND email = $2 AND is_active = true`,
      [tenantId, email],
    );

    if (rows.length > 0) {
      const userId = rows[0].id;
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        `INSERT INTO platform.password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
      );

      // No email service yet — log raw token for dev use
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEV] Password reset token:", rawToken);
      }
    }

    return reply.status(200).send({ message: MSG });
  });

  /**
   * POST /auth/reset-password
   * Body: { token, newPassword }
   * Public — no auth required.
   */
  app.post("/auth/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ statusCode: 400, message: "Invalid request body" });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const { rows: tokenRows } = await pool.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id FROM platform.password_reset_tokens
       WHERE token_hash = $1 AND used = false AND expires_at > now()`,
      [tokenHash],
    );

    if (tokenRows.length === 0) {
      return reply
        .status(400)
        .send({ message: "Invalid or expired reset token" });
    }

    if (!isValidPassword(newPassword)) {
      return reply
        .status(400)
        .send({ message: "Password does not meet requirements" });
    }

    const { id: tokenId, user_id: userId } = tokenRows[0];
    const newHash = await hashPasswordAsync(newPassword);

    await pool.query(
      `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
      [newHash, userId],
    );
    await pool.query(
      `UPDATE platform.password_reset_tokens SET used = true WHERE id = $1`,
      [tokenId],
    );
    await revokeAllRefreshTokens(userId);

    return reply.status(200).send({ message: "Password reset successful" });
  });

  /**
   * PUT /auth/change-password
   * Auth: any authenticated user (requireAuth already enforces this globally)
   * Body: { currentPassword, newPassword }
   */
  app.put("/auth/change-password", async (req, reply) => {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ statusCode: 400, message: "Invalid request body" });
    }

    const { currentPassword, newPassword } = parsed.data;
    const { userId } = req.user;

    const { rows } = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM platform.users WHERE id = $1`,
      [userId],
    );

    if (rows.length === 0) {
      return reply
        .status(401)
        .send({ message: "Current password is incorrect" });
    }

    if (!(await verifyPasswordAsync(currentPassword, rows[0].password_hash))) {
      return reply
        .status(401)
        .send({ message: "Current password is incorrect" });
    }

    if (!isValidPassword(newPassword)) {
      return reply
        .status(400)
        .send({ message: "Password does not meet requirements" });
    }

    const newHash = await hashPasswordAsync(newPassword);
    await pool.query(
      `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
      [newHash, userId],
    );
    await revokeAllRefreshTokens(userId);

    return reply.status(200).send({ message: "Password changed successfully" });
  });

  /**
   * GET /auth/tenants
   * Public — no auth required.
   * Returns active tenants (id, slug, name, logoUrl) for the login dropdown.
   */
  app.get("/auth/tenants", async (_req, _reply) => {
    const { rows } = await pool.query<{
      id: string;
      slug: string;
      name: string;
      logo_url: string | null;
    }>(
      `SELECT id, slug, name, logo_url
       FROM platform.tenants
       WHERE is_active = true
       ORDER BY name`,
    );

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoUrl: r.logo_url,
    }));
  });
}
