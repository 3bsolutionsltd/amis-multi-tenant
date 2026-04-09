/**
 * Prompt 16 — Password utility + platform.users DB constraint tests.
 *
 * Unit tests (always run):
 *   - hashPassword produces a unique hash each call (random salt)
 *   - verifyPassword accepts the correct password
 *   - verifyPassword rejects a wrong password
 *
 * Integration tests (require DATABASE_URL + APP_DATABASE_URL in .env):
 *   - UNIQUE(tenant_id, email) constraint is enforced
 *   - All 7 roles are accepted by the CHECK constraint
 *   - An invalid role is rejected by the CHECK constraint
 *   - RLS: amis_app role querying with Tenant A context cannot see Tenant B users
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { hashPassword, verifyPasswordAsync } from "../../lib/password.js";

// ------------------------------------------------------------------ unit tests

describe("password utilities (unit)", () => {
  it("hashPassword produces a different hash each call (random salt)", () => {
    const h1 = hashPassword("Password123!");
    const h2 = hashPassword("Password123!");
    expect(h1).not.toBe(h2);
  });

  it("verifyPassword returns true for the correct password", async () => {
    const hash = hashPassword("Password123!");
    expect(await verifyPasswordAsync("Password123!", hash)).toBe(true);
  });

  it("verifyPassword returns false for a wrong password", async () => {
    const hash = hashPassword("Password123!");
    expect(await verifyPasswordAsync("WrongPassword!", hash)).toBe(false);
  });

  it("verifyPassword returns false for an empty string", async () => {
    const hash = hashPassword("Password123!");
    expect(await verifyPasswordAsync("", hash)).toBe(false);
  });

  it("verifyPassword returns false for a corrupted hash", async () => {
    expect(await verifyPasswordAsync("Password123!", "not-a-valid-hash")).toBe(
      false,
    );
  });
});

// ------------------------------------------------------------------ integration tests

const DATABASE_URL = process.env.DATABASE_URL;
const APP_DATABASE_URL = process.env.APP_DATABASE_URL;

const describeIf = DATABASE_URL && APP_DATABASE_URL ? describe : describe.skip;

describeIf("platform.users DB constraints (integration)", () => {
  const adminPool = new pg.Pool({ connectionString: DATABASE_URL });
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });

  let tenantAId: string;
  let tenantBId: string;

  // Temporary emails used only in this test run — cleaned up in afterAll.
  const UNIQUE_EMAIL = `unique-constraint-${Date.now()}@pw-test.local`;
  const ROLE_EMAIL_PREFIX = `role-check-${Date.now()}`;
  const RLS_EMAIL = `rls-b-user-${Date.now()}@pw-test.local`;

  beforeAll(async () => {
    const { rows } = await adminPool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM platform.tenants
       WHERE slug IN ('greenfield-vti', 'riverside-tech')`,
    );
    tenantAId = rows.find((r) => r.slug === "greenfield-vti")!.id;
    tenantBId = rows.find((r) => r.slug === "riverside-tech")!.id;
  });

  afterAll(async () => {
    await adminPool.query(
      `DELETE FROM platform.users WHERE email LIKE '%@pw-test.local'`,
    );
    await adminPool.end();
    await appPool.end();
  });

  // ---- UNIQUE constraint --------------------------------------------------

  it("UNIQUE(tenant_id, email) rejects a duplicate email in the same tenant", async () => {
    const hash = hashPassword("Password123!");
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      [tenantAId, UNIQUE_EMAIL, hash],
    );
    await expect(
      adminPool.query(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        [tenantAId, UNIQUE_EMAIL, hash],
      ),
    ).rejects.toThrow(/unique/i);
  });

  it("UNIQUE(tenant_id, email) allows the same email for different tenants", async () => {
    const hash = hashPassword("Password123!");
    // UNIQUE_EMAIL already exists for Tenant A — inserting for Tenant B should succeed.
    await expect(
      adminPool.query(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [tenantBId, UNIQUE_EMAIL, hash],
      ),
    ).resolves.toBeDefined();
  });

  // ---- CHECK constraint — all 7 valid roles --------------------------------

  it.each([
    "admin",
    "registrar",
    "hod",
    "instructor",
    "finance",
    "principal",
    "dean",
  ])("CHECK constraint accepts role '%s'", async (role) => {
    const email = `${ROLE_EMAIL_PREFIX}-${role}@pw-test.local`;
    const hash = hashPassword("Password123!");
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [tenantAId, email, hash, role],
    );
    const { rows } = await adminPool.query<{ role: string }>(
      `SELECT role FROM platform.users WHERE tenant_id = $1 AND email = $2`,
      [tenantAId, email],
    );
    expect(rows[0]?.role).toBe(role);
    // Clean up immediately so afterAll is lighter.
    await adminPool.query(
      `DELETE FROM platform.users WHERE tenant_id = $1 AND email = $2`,
      [tenantAId, email],
    );
  });

  it("CHECK constraint rejects an invalid role", async () => {
    const hash = hashPassword("Password123!");
    await expect(
      adminPool.query(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'superuser')`,
        [tenantAId, `invalid-role-${Date.now()}@pw-test.local`, hash],
      ),
    ).rejects.toThrow();
  });

  // ---- RLS isolation -------------------------------------------------------

  it("RLS: amis_app with Tenant A context cannot see Tenant B users", async () => {
    // Insert a user for Tenant B (using superuser — bypasses RLS).
    const hash = hashPassword("Password123!");
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenantBId, RLS_EMAIL, hash],
    );

    // Query via amis_app (subject to RLS) scoped to Tenant A.
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE email = $1`,
        [RLS_EMAIL],
      );
      // RLS must hide the Tenant B row.
      expect(rows).toHaveLength(0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  it("RLS: amis_app with Tenant B context CAN see Tenant B users", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE email = $1`,
        [RLS_EMAIL],
      );
      // Should be visible within the correct tenant context.
      expect(rows.length).toBeGreaterThan(0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });
});
