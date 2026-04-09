/**
 * Prompt 17 â€” Auth endpoint integration tests
 *
 * Covers:
 *   POST /auth/login   â€” credentials validation, token issuance
 *   POST /auth/refresh â€” token rotation, revocation checks
 *   POST /auth/logout  â€” always 204
 *   GET  /auth/me      â€” JWT verification, user lookup
 *
 * Requires DATABASE_URL and JWT_SECRET in .env (loaded by test-setup.ts).
 * Uses the two dev tenants seeded by db/seeds/seed.ts.
 *
 *   Tenant A (Greenfield VTI):        10e575a2-2e59-437b-b251-c5b906a482d8
 *   Tenant B (Riverside Tech College): b6c79654-fa01-4598-90ad-5467760e57e2
 *   User:     admin@tenant-a.test  / Password123!
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import jwt from "jsonwebtoken";
import { buildApp } from "../../app.js";
import { hashPassword } from "../../lib/password.js";

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

/* Skip all tests if the DB or JWT_SECRET is unavailable */
const describeIf = DATABASE_URL && JWT_SECRET ? describe : describe.skip;

// ------------------------------------------------------------------ constants

const TENANT_A = "10e575a2-2e59-437b-b251-c5b906a482d8";
const TENANT_B = "b6c79654-fa01-4598-90ad-5467760e57e2";

const VALID_EMAIL = "admin@tenant-a.test";
const VALID_PASSWORD = "Password123!";

// ------------------------------------------------------------------ helpers

/** Sign an already-expired JWT for testing rejection of stale tokens. */
function expiredToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign(
    { sub: userId, tenantId, role },
    JWT_SECRET as string,
    { expiresIn: -1 }, // immediately expired
  );
}

/** Tamper the signature of a valid-looking JWT. */
function tamperedToken(valid: string): string {
  const parts = valid.split(".");
  parts[2] = parts[2].slice(0, -4) + "XXXX";
  return parts.join(".");
}

// ------------------------------------------------------------------ test suite

describeIf("Auth endpoints (integration)", () => {
  const app = buildApp();
  const adminPool = new pg.Pool({ connectionString: DATABASE_URL });

  /** Real DB id of the seeded admin@tenant-a.test user */
  let tenantAAdminId: string;
  /** ID of temp user deleted during the "deleted mid-session" test */
  let tempUserId: string;

  beforeAll(async () => {
    const pwHash = hashPassword(VALID_PASSWORD);

    // Resolve the seeded admin user's real DB id
    const { rows } = await adminPool.query<{ id: string }>(
      `SELECT id FROM platform.users WHERE tenant_id = $1 AND email = $2`,
      [TENANT_A, VALID_EMAIL],
    );
    tenantAAdminId = rows[0].id;

    // Insert an inactive user for Tenant A
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
       VALUES ($1, 'inactive@auth-test.local', $2, 'registrar', false)
       ON CONFLICT (tenant_id, email)
         DO UPDATE SET is_active = false, password_hash = EXCLUDED.password_hash`,
      [TENANT_A, pwHash],
    );

    // Insert a temp user that will be deleted inside the "deleted mid-session" test
    const { rows: tempRows } = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES ($1, 'delete-me@auth-test.local', $2, 'registrar')
       ON CONFLICT (tenant_id, email)
         DO UPDATE SET is_active = true, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [TENANT_A, pwHash],
    );
    tempUserId = tempRows[0].id;
  });

  afterAll(async () => {
    // Refresh tokens cascade-deleted via FK when users are deleted
    await adminPool.query(
      `DELETE FROM platform.users
       WHERE tenant_id = $1 AND email LIKE '%@auth-test.local'`,
      [TENANT_A],
    );
    await adminPool.end();
    await app.close();
  });

  // ================================================================ /auth/login

  describe("POST /auth/login", () => {
    it("returns 200 with accessToken, refreshToken, and user on valid credentials", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.accessToken).toBe("string");
      expect(typeof body.refreshToken).toBe("string");
      expect(body.user).toMatchObject({
        email: VALID_EMAIL,
        role: "admin",
        tenantId: TENANT_A,
      });
      expect(typeof body.user.id).toBe("string");
    });

    it("returns 401 with 'Invalid credentials' for wrong password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: "WrongPassword!",
          tenantId: TENANT_A,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid credentials");
    });

    it("returns 401 with 'Invalid credentials' for unknown email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "nobody@tenant-a.test",
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid credentials");
    });

    it("returns 401 with 'Account disabled' for inactive user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "inactive@auth-test.local",
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Account disabled");
    });

    it("returns 400 when tenantId is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: VALID_EMAIL, password: VALID_PASSWORD },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when email is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { password: VALID_PASSWORD, tenantId: TENANT_A },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when password is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: VALID_EMAIL, tenantId: TENANT_A },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects Tenant A credentials when tenantId is Tenant B (cross-tenant)", async () => {
      // admin@tenant-a.test does not exist in Tenant B â†’ Invalid credentials
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_B,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid credentials");
    });
  });

  // ================================================================ /auth/refresh

  describe("POST /auth/refresh", () => {
    it("returns 200 with a new token pair for a valid refresh token", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const { refreshToken } = loginRes.json();

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.accessToken).toBe("string");
      expect(typeof body.refreshToken).toBe("string");
      expect(body.user.tenantId).toBe(TENANT_A);
    });

    it("rejects the old token after rotation (one-time use / token rotation)", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const firstToken = loginRes.json().refreshToken;

      // First refresh â€” rotates firstToken â†’ secondToken
      const refreshRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: firstToken },
      });
      expect(refreshRes.statusCode).toBe(200);

      // Reusing firstToken must now be rejected
      const reuseRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: firstToken },
      });
      expect(reuseRes.statusCode).toBe(401);
    });

    it("returns 401 for a tampered / unknown refresh token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "not-a-real-token-" + "x".repeat(60) },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid or expired refresh token");
    });

    it("returns 401 for an already-revoked refresh token", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const { refreshToken } = loginRes.json();

      // Logout revokes the token
      await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken },
      });

      const refreshRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken },
      });
      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.json().message).toBe(
        "Invalid or expired refresh token",
      );
    });
  });

  // ================================================================ /auth/logout

  describe("POST /auth/logout", () => {
    it("returns 204 for a valid refresh token", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const { refreshToken } = loginRes.json();

      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(204);
    });

    it("returns 204 for an already-revoked token (idempotent)", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const { refreshToken } = loginRes.json();

      await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken },
      });

      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(204);
    });

    it("returns 204 for an unknown token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken: "completely-unknown-token-value" },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ================================================================ /auth/me

  describe("GET /auth/me", () => {
    let validAccessToken: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      validAccessToken = res.json().accessToken;
    });

    it("returns 200 with user details for a valid JWT", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${validAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        email: VALID_EMAIL,
        role: "admin",
        tenantId: TENANT_A,
        isActive: true,
      });
      expect(typeof body.id).toBe("string");
    });

    it("returns 401 for an expired JWT", async () => {
      const token = expiredToken(tenantAAdminId, TENANT_A, "admin");
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for a tampered JWT", async () => {
      const token = tamperedToken(validAccessToken);
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when Authorization header is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when user was deleted after token was issued", async () => {
      // Get a token for the temp user (may already be deleted if this test ran twice;
      // beforeAll re-inserts it so it should exist)
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "delete-me@auth-test.local",
          password: VALID_PASSWORD,
          tenantId: TENANT_A,
        },
      });
      const token = loginRes.json().accessToken;

      // Delete the user (cascade removes refresh_tokens too)
      await adminPool.query(`DELETE FROM platform.users WHERE id = $1`, [
        tempUserId,
      ]);

      // /auth/me must now return 401 â€” user no longer exists in DB
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

});
