/**
 * RLS Isolation Integration Test — platform.users
 *
 * Proves that tenant A cannot read tenant B's users through Postgres RLS.
 * Uses the `amis_app` non-superuser role (subject to RLS policy).
 * Requires APP_DATABASE_URL to be set (see .env).
 *
 * The postgres superuser bypasses RLS regardless of FORCE ROW LEVEL SECURITY,
 * so this test intentionally connects as the non-privileged amis_app role.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const APP_DATABASE_URL = process.env.APP_DATABASE_URL;

// Skip if no app DB URL (e.g. CI without Postgres)
const describeIf = APP_DATABASE_URL ? describe : describe.skip;

describeIf("RLS isolation — platform.users (integration)", () => {
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });

  // Superuser pool for setup / teardown (bypasses RLS on platform schema)
  const adminPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    // Ensure amis_app has access to the platform schema tables
    await adminPool.query(
      `GRANT USAGE ON SCHEMA platform TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;`,
    );

    // Create two isolated test tenants
    const resA = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-users-tenant-a', 'RLS Users Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const resB = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-users-tenant-b', 'RLS Users Tenant B')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );

    tenantAId = resA.rows[0].id;
    tenantBId = resB.rows[0].id;

    // Seed users for each tenant via the superuser connection.
    // password_hash is a dummy placeholder (not a real credential).
    // Using ON CONFLICT on the composite unique key (tenant_id, email).
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES
         ($1, 'alice-rls@tenant-a.test',  '$2b$10$placeholder_hash_a1', 'admin'),
         ($1, 'bob-rls@tenant-a.test',    '$2b$10$placeholder_hash_a2', 'registrar')
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenantAId],
    );
    await adminPool.query(
      `INSERT INTO platform.users (tenant_id, email, password_hash, role)
       VALUES
         ($1, 'carol-rls@tenant-b.test', '$2b$10$placeholder_hash_b1', 'admin')
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenantBId],
    );
  });

  afterAll(async () => {
    // Deleting tenants cascades to platform.users via ON DELETE CASCADE
    await adminPool.query(
      `DELETE FROM platform.tenants
       WHERE slug IN ('rls-users-tenant-a', 'rls-users-tenant-b')`,
    );
    await appPool.end();
    await adminPool.end();
  });

  it("tenant A only sees its own users", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query(
        "SELECT id, email, tenant_id FROM platform.users",
      );
      await client.query("COMMIT");

      // All rows must belong to tenant A
      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantAId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant B only sees its own users", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const res = await client.query(
        "SELECT id, email, tenant_id FROM platform.users",
      );
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantBId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant A cannot read tenant B's users even with explicit tenant_id filter", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Context is set to tenant A
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      // Attempt to read tenant B's rows directly
      const res = await client.query(
        "SELECT id, email FROM platform.users WHERE tenant_id = $1",
        [tenantBId],
      );
      await client.query("COMMIT");

      // RLS must return 0 rows — the WHERE clause is AND-ed with the policy
      expect(res.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("tenant A cannot insert a user into tenant B", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Context is tenant A
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      // Attempt to insert a user for tenant B
      await expect(
        client.query(
          `INSERT INTO platform.users (tenant_id, email, password_hash, role)
           VALUES ($1, 'injected-rls@tenant-b.test', '$2b$10$placeholder_inject', 'admin')`,
          [tenantBId],
        ),
      ).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
