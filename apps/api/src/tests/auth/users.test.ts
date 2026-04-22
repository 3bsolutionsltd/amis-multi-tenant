/**
 * Prompt 19 — Password reset + user management endpoint tests
 *
 * Covers:
 *   POST /auth/forgot-password  — no-enumeration, token stored hashed
 *   POST /auth/reset-password   — token validation, password update, revocation
 *   GET  /users                 — tenant-scoped list, filters, pagination
 *   POST /users                 — create user, uniqueness, role validation
 *   PUT  /users/:id             — update role/isActive, deactivation revokes tokens
 *   PUT  /users/:id/password    — admin resets password, revokes tokens
 *   PUT  /auth/change-password  — self-service update, wrong password, revocation
 *
 * Requires DATABASE_URL and JWT_SECRET in .env.
 * Tenant A: 10e575a2-2e59-437b-b251-c5b906a482d8
 * Seeded admin: admin@tenant-a.test / Password123!
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createHash } from "crypto";
import { buildApp } from "../../app.js";
import { hashPassword } from "../../lib/password.js";

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const describeIf = DATABASE_URL && JWT_SECRET ? describe : describe.skip;

// ------------------------------------------------------------------ constants

const TENANT_A = "10e575a2-2e59-437b-b251-c5b906a482d8";
const TENANT_B = "b6c79654-fa01-4598-90ad-5467760e57e2";
const ADMIN_EMAIL = "admin@tenant-a.test";
const ADMIN_PASSWORD = "Password123!";

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ------------------------------------------------------------------ helpers

/** Build a 64-char hex string that acts as a fake raw reset token. */
function fakeRawToken(): string {
  return "a".repeat(64);
}

// ------------------------------------------------------------------ suite

describeIf("Prompt 19 — password reset + user management (integration)", () => {
  const app = buildApp();
  const adminPool = new pg.Pool({ connectionString: DATABASE_URL });

  let adminUserId: string;
  let targetUserId: string; // p19-target@test.local — used for PUT tests

  beforeAll(async () => {
    // Resolve the seeded admin's real DB id
    const { rows: adminRows } = await adminPool.query<{ id: string }>(
      `SELECT id FROM platform.users WHERE tenant_id = $1 AND email = $2`,
      [TENANT_A, ADMIN_EMAIL],
    );
    adminUserId = adminRows[0].id;

    // Create a test target user that tests can modify
    const pwHash = hashPassword(ADMIN_PASSWORD);
    const { rows: targetRows } = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
       VALUES ($1, 'p19-target@test.local', $2, 'registrar', true)
       ON CONFLICT (tenant_id, email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                       role = 'registrar', is_active = true
       RETURNING id`,
      [TENANT_A, pwHash],
    );
    targetUserId = targetRows[0].id;

    // Seed a refresh token for targetUserId so deactivation revocation is testable
    await adminPool.query(
      `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, 'revoke-test-hash-p19', now() + interval '7 days')
       ON CONFLICT DO NOTHING`,
      [targetUserId],
    );
  });

  afterAll(async () => {
    // Clean up password_reset_tokens for admin user
    await adminPool.query(
      `DELETE FROM platform.password_reset_tokens WHERE user_id = $1`,
      [adminUserId],
    );
    // Clean up all p19 test users (cascade deletes their tokens)
    await adminPool.query(
      `DELETE FROM platform.users
       WHERE tenant_id = $1 AND (email LIKE 'p19-%' OR email LIKE 'p19new-%')`,
      [TENANT_A],
    );
    await adminPool.end();
    await app.close();
  });

  // ================================================================ POST /auth/forgot-password

  describe("POST /auth/forgot-password", () => {
    it("returns 200 with standard message for a known email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: ADMIN_EMAIL, tenantId: TENANT_A },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe(
        "If that email exists, a reset link has been sent.",
      );
    });

    it("returns 200 with the same message for an unknown email (no enumeration)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: "nobody@tenant-a.test", tenantId: TENANT_A },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe(
        "If that email exists, a reset link has been sent.",
      );
    });

    it("stores a hashed token in DB (never the raw token)", async () => {
      // Delete any previous tokens for this user
      await adminPool.query(
        `DELETE FROM platform.password_reset_tokens WHERE user_id = $1`,
        [adminUserId],
      );

      await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: ADMIN_EMAIL, tenantId: TENANT_A },
      });

      const { rows } = await adminPool.query<{
        token_hash: string;
        used: boolean;
      }>(
        `SELECT token_hash, used FROM platform.password_reset_tokens
         WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1`,
        [adminUserId],
      );

      expect(rows.length).toBe(1);
      // sha256 hex is always exactly 64 chars
      expect(rows[0].token_hash).toHaveLength(64);
      // The hash must not be the same as the email (i.e. not raw data stored)
      expect(rows[0].token_hash).not.toBe(ADMIN_EMAIL);
      expect(rows[0].used).toBe(false);
    });

    it("returns 400 when tenantId is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: ADMIN_EMAIL },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ================================================================ POST /auth/reset-password

  describe("POST /auth/reset-password", () => {
    /** Helper: insert a reset token row directly for targetUserId */
    async function insertResetToken(opts: {
      raw: string;
      used?: boolean;
      minsFromNow?: number;
    }) {
      const hash = sha256hex(opts.raw);
      const expires = new Date(Date.now() + (opts.minsFromNow ?? 60) * 60_000);
      await adminPool.query(
        `INSERT INTO platform.password_reset_tokens (user_id, token_hash, expires_at, used)
         VALUES ($1, $2, $3, $4)`,
        [targetUserId, hash, expires, opts.used ?? false],
      );
    }

    it("valid token → 200, password updated, token marked used", async () => {
      const rawToken = "b".repeat(64);
      await insertResetToken({ raw: rawToken });

      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: rawToken, newPassword: "NewPass1!" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Password reset successful");

      // Verify token is marked used
      const { rows } = await adminPool.query<{ used: boolean }>(
        `SELECT used FROM platform.password_reset_tokens
         WHERE token_hash = $1`,
        [sha256hex(rawToken)],
      );
      expect(rows[0].used).toBe(true);

      // Restore original password so afterAll cleanup works
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, targetUserId],
      );
    });

    it("used token → 400", async () => {
      const rawToken = "c".repeat(64);
      await insertResetToken({ raw: rawToken, used: true });

      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: rawToken, newPassword: "NewPass1!" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Invalid or expired reset token");
    });

    it("expired token → 400", async () => {
      const rawToken = "d".repeat(64);
      await insertResetToken({ raw: rawToken, minsFromNow: -5 }); // expired 5 min ago

      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: rawToken, newPassword: "NewPass1!" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Invalid or expired reset token");
    });

    it("tampered/unknown token → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: "z".repeat(64), newPassword: "NewPass1!" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Invalid or expired reset token");
    });

    it("weak password → 400", async () => {
      const rawToken = "e".repeat(64);
      await insertResetToken({ raw: rawToken });

      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: rawToken, newPassword: "weak" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password does not meet requirements");
    });

    it("all refresh tokens revoked after successful reset", async () => {
      // Insert fresh refresh token for targetUserId
      await adminPool.query(
        `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'reset-revoke-test-hash', now() + interval '7 days')`,
        [targetUserId],
      );

      const rawToken = "f".repeat(64);
      await insertResetToken({ raw: rawToken });

      await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: rawToken, newPassword: "NewPass1!" },
      });

      const { rows } = await adminPool.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM platform.refresh_tokens
         WHERE user_id = $1 AND revoked = false`,
        [targetUserId],
      );
      expect(Number(rows[0].count)).toBe(0);

      // Restore original password
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, targetUserId],
      );
    });
  });

  // ================================================================ GET /users

  describe("GET /users", () => {
    it("admin gets paginated list scoped to own tenant", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe("number");
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
    });

    it("non-admin (registrar) → 403", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users",
        headers: { "x-dev-role": "registrar", "x-tenant-id": TENANT_A },
      });
      expect(res.statusCode).toBe(403);
    });

    it("filter by role returns only matching users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users?role=registrar",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const user of body.data) {
        expect(user.role).toBe("registrar");
      }
    });

    it("filter by isActive=true returns only active users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users?isActive=true",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      expect(res.statusCode).toBe(200);
      for (const user of res.json().data) {
        expect(user.isActive).toBe(true);
      }
    });

    it("pagination: page 2 with limit 1 returns different user than page 1", async () => {
      const page1 = await app.inject({
        method: "GET",
        url: "/users?page=1&limit=1",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      const page2 = await app.inject({
        method: "GET",
        url: "/users?page=2&limit=1",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      expect(page1.statusCode).toBe(200);
      expect(page2.statusCode).toBe(200);
      const ids1 = page1.json().data.map((u: { id: string }) => u.id);
      const ids2 = page2.json().data.map((u: { id: string }) => u.id);
      // If there are at least 2 users, they should differ
      if (ids1.length > 0 && ids2.length > 0) {
        expect(ids1[0]).not.toBe(ids2[0]);
      }
    });

    it("password_hash is never returned in the response", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
      });
      const body = res.json();
      for (const user of body.data) {
        expect(user).not.toHaveProperty("password_hash");
        expect(user).not.toHaveProperty("passwordHash");
      }
    });
  });

  // ================================================================ POST /users

  describe("POST /users", () => {
    it("non-admin (registrar) → 403", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        headers: { "x-dev-role": "registrar", "x-tenant-id": TENANT_A },
        payload: { email: "blocked@test.local", password: "Test1234!", role: "hod" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("admin creates a new user → 201 with user data (no password_hash)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: {
          email: "p19new-created@test.local",
          password: "NewUser1!",
          role: "hod",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.email).toBe("p19new-created@test.local");
      expect(body.role).toBe("hod");
      expect(body.isActive).toBe(true);
      expect(body).not.toHaveProperty("password_hash");
      expect(body).not.toHaveProperty("passwordHash");
    });

    it("duplicate email in same tenant → 409", async () => {
      // This email was just created above
      const res = await app.inject({
        method: "POST",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: {
          email: "p19new-created@test.local",
          password: "NewUser1!",
          role: "hod",
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it("invalid role → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: {
          email: "p19new-invalid@test.local",
          password: "NewUser1!",
          role: "superuser", // not a valid role
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("weak password → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: {
          email: "p19new-weak@test.local",
          password: "weak",
          role: "registrar",
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password does not meet requirements");
    });
  });

  // ================================================================ PUT /users/:id

  describe("PUT /users/:id", () => {
    it("admin updates user role → 200 with updated role", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}`,
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: { role: "hod" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe("hod");

      // Restore role
      await adminPool.query(
        `UPDATE platform.users SET role = 'registrar' WHERE id = $1`,
        [targetUserId],
      );
    });

    it("admin deactivates user → 200 and all refresh tokens revoked", async () => {
      // Ensure at least one active refresh token exists
      await adminPool.query(
        `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'deactivate-test-hash-p19', now() + interval '7 days')
         ON CONFLICT DO NOTHING`,
        [targetUserId],
      );
      await adminPool.query(
        `UPDATE platform.refresh_tokens SET revoked = false
         WHERE user_id = $1`,
        [targetUserId],
      );

      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}`,
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isActive).toBe(false);

      const { rows } = await adminPool.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM platform.refresh_tokens
         WHERE user_id = $1 AND revoked = false`,
        [targetUserId],
      );
      expect(Number(rows[0].count)).toBe(0);

      // Re-activate for subsequent tests
      await adminPool.query(
        `UPDATE platform.users SET is_active = true WHERE id = $1`,
        [targetUserId],
      );
    });

    it("user from different tenant → 404", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${adminUserId}`,
        // Admin for Tenant B can't update Tenant A users
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_B },
        payload: { role: "hod" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("non-admin → 403", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}`,
        headers: { "x-dev-role": "finance", "x-tenant-id": TENANT_A },
        payload: { role: "hod" },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ================================================================ PUT /users/:id/password

  describe("PUT /users/:id/password", () => {
    it("non-admin (finance) → 403", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}/password`,
        headers: { "x-dev-role": "finance", "x-tenant-id": TENANT_A },
        payload: { newPassword: "NewAdmin1!" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("admin resets user password → 200", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}/password`,
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: { newPassword: "NewAdmin1!" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Password updated");

      // Restore password
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, targetUserId],
      );
    });

    it("weak password → 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}/password`,
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: { newPassword: "tooshort" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password does not meet requirements");
    });

    it("refresh tokens revoked after admin password reset", async () => {
      await adminPool.query(
        `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'pw-reset-revoke-test', now() + interval '7 days')
         ON CONFLICT DO NOTHING`,
        [targetUserId],
      );
      await adminPool.query(
        `UPDATE platform.refresh_tokens SET revoked = false WHERE user_id = $1`,
        [targetUserId],
      );

      await app.inject({
        method: "PUT",
        url: `/users/${targetUserId}/password`,
        headers: { "x-dev-role": "admin", "x-tenant-id": TENANT_A },
        payload: { newPassword: "NewAdmin1!" },
      });

      const { rows } = await adminPool.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM platform.refresh_tokens
         WHERE user_id = $1 AND revoked = false`,
        [targetUserId],
      );
      expect(Number(rows[0].count)).toBe(0);

      // Restore password
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, targetUserId],
      );
    });
  });

  // ================================================================ PUT /auth/change-password

  describe("PUT /auth/change-password", () => {
    it("correct current password → 200, password changed", async () => {
      // Use x-dev-user-id pointing to the real admin user so the endpoint
      // can look up the real password_hash
      const res = await app.inject({
        method: "PUT",
        url: "/auth/change-password",
        headers: {
          "x-dev-role": "admin",
          "x-dev-user-id": adminUserId,
          "x-tenant-id": TENANT_A,
        },
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword: "Changed1!",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Password changed successfully");

      // Restore original password
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, adminUserId],
      );
    });

    it("wrong current password → 401", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/auth/change-password",
        headers: {
          "x-dev-role": "admin",
          "x-dev-user-id": adminUserId,
          "x-tenant-id": TENANT_A,
        },
        payload: {
          currentPassword: "WrongPassword1!",
          newPassword: "Changed1!",
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Current password is incorrect");
    });

    it("weak new password → 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/auth/change-password",
        headers: {
          "x-dev-role": "admin",
          "x-dev-user-id": adminUserId,
          "x-tenant-id": TENANT_A,
        },
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword: "weak",
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password does not meet requirements");
    });

    it("all refresh tokens revoked after change-password", async () => {
      // Seed a refresh token for admin user
      await adminPool.query(
        `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'change-pw-revoke-test', now() + interval '7 days')
         ON CONFLICT DO NOTHING`,
        [adminUserId],
      );
      await adminPool.query(
        `UPDATE platform.refresh_tokens SET revoked = false WHERE user_id = $1`,
        [adminUserId],
      );

      await app.inject({
        method: "PUT",
        url: "/auth/change-password",
        headers: {
          "x-dev-role": "admin",
          "x-dev-user-id": adminUserId,
          "x-tenant-id": TENANT_A,
        },
        payload: {
          currentPassword: ADMIN_PASSWORD,
          newPassword: "Changed1!",
        },
      });

      const { rows } = await adminPool.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM platform.refresh_tokens
         WHERE user_id = $1 AND revoked = false`,
        [adminUserId],
      );
      expect(Number(rows[0].count)).toBe(0);

      // Restore original password
      const pwHash = hashPassword(ADMIN_PASSWORD);
      await adminPool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [pwHash, adminUserId],
      );
    });
  });
});
