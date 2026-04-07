/**
 * RLS Isolation Integration Test
 *
 * Proves that tenant A cannot read tenant B's students through Postgres RLS.
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

describeIf("RLS isolation (integration)", () => {
  // Two pools: one per tenant to keep contexts clean
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });

  let tenantAId: string;
  let tenantBId: string;

  // We need the postgres superuser for setup (creating tenants bypasses RLS on platform schema)
  const adminPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  beforeAll(async () => {
    // Create two isolated test tenants using the admin connection
    const resA = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-test-tenant-a', 'RLS Test Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const resB = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-test-tenant-b', 'RLS Test Tenant B')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );

    tenantAId = resA.rows[0].id;
    tenantBId = resB.rows[0].id;

    // Grant amis_app permissions on sequences too (needed for gen_random_uuid default)
    await adminPool.query(
      `GRANT USAGE ON SCHEMA app TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;`,
    );

    // Seed students for each tenant via the admin connection (which can bypass RLS for setup)
    const adminClient = await adminPool.connect();
    try {
      // Tenant A students
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      await adminClient.query(
        `INSERT INTO app.students (tenant_id, first_name, last_name)
         VALUES ($1, 'Alice', 'RLS-A'), ($1, 'Bob', 'RLS-A')`,
        [tenantAId],
      );
      await adminClient.query("COMMIT");

      // Tenant B students
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      await adminClient.query(
        `INSERT INTO app.students (tenant_id, first_name, last_name)
         VALUES ($1, 'Carol', 'RLS-B')`,
        [tenantBId],
      );
      await adminClient.query("COMMIT");
    } finally {
      adminClient.release();
    }
  });

  afterAll(async () => {
    // Delete test tenants (cascades to app.students)
    await adminPool.query(
      `DELETE FROM platform.tenants WHERE slug IN ('rls-test-tenant-a', 'rls-test-tenant-b')`,
    );
    await appPool.end();
    await adminPool.end();
  });

  it("tenant A only sees its own students", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query("SELECT * FROM app.students");
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

  it("tenant B only sees its own students", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const res = await client.query("SELECT * FROM app.students");
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantBId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant A cannot read tenant B's students even with explicit tenant_id filter", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Context is set to tenant A
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      // Try to explicitly query for tenant B's data
      const res = await client.query(
        "SELECT * FROM app.students WHERE tenant_id = $1",
        [tenantBId],
      );
      await client.query("COMMIT");

      // RLS must return 0 rows — the WHERE clause is AND-ed with the policy
      expect(res.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });
});
