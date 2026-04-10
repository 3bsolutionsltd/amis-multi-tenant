/**
 * RLS Isolation Integration Test — app.term_registrations
 *
 * Proves that tenant A cannot read tenant B's term registrations through
 * Postgres RLS. Uses the `amis_app` non-superuser role (subject to RLS).
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

describeIf("RLS isolation — app.term_registrations (integration)", () => {
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });
  const adminPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let tenantAId: string;
  let tenantBId: string;
  let studentAId: string;
  let studentBId: string;

  beforeAll(async () => {
    // Ensure amis_app can access app + platform schemas
    await adminPool.query(
      `GRANT USAGE ON SCHEMA app TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO amis_app;
       GRANT USAGE ON SCHEMA platform TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;`,
    );

    // Create two isolated test tenants via superuser
    const resA = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-termreg-tenant-a', 'RLS TermReg Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const resB = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-termreg-tenant-b', 'RLS TermReg Tenant B')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );

    tenantAId = resA.rows[0].id;
    tenantBId = resB.rows[0].id;

    const adminClient = await adminPool.connect();
    try {
      // Seed: student + term registration for tenant A
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const sA = await adminClient.query<{ id: string }>(
        `INSERT INTO app.students (tenant_id, first_name, last_name)
         VALUES ($1, 'Alice', 'TermReg-A')
         RETURNING id`,
        [tenantAId],
      );
      studentAId = sA.rows[0].id;
      await adminClient.query(
        `INSERT INTO app.term_registrations (tenant_id, student_id, academic_year, term)
         VALUES ($1, $2, '2026/2027', 'Term 1')`,
        [tenantAId, studentAId],
      );
      await adminClient.query("COMMIT");

      // Seed: student + term registration for tenant B
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const sB = await adminClient.query<{ id: string }>(
        `INSERT INTO app.students (tenant_id, first_name, last_name)
         VALUES ($1, 'Carol', 'TermReg-B')
         RETURNING id`,
        [tenantBId],
      );
      studentBId = sB.rows[0].id;
      await adminClient.query(
        `INSERT INTO app.term_registrations (tenant_id, student_id, academic_year, term)
         VALUES ($1, $2, '2026/2027', 'Term 1')`,
        [tenantBId, studentBId],
      );
      await adminClient.query("COMMIT");
    } finally {
      adminClient.release();
    }
  });

  afterAll(async () => {
    // Clean up in dependency order: term_registrations → students → tenants
    await adminPool.query(
      `DELETE FROM app.term_registrations
       WHERE tenant_id IN (
         SELECT id FROM platform.tenants
         WHERE slug IN ('rls-termreg-tenant-a', 'rls-termreg-tenant-b')
       )`,
    );
    await adminPool.query(
      `DELETE FROM app.students
       WHERE tenant_id IN (
         SELECT id FROM platform.tenants
         WHERE slug IN ('rls-termreg-tenant-a', 'rls-termreg-tenant-b')
       )`,
    );
    await adminPool.query(
      `DELETE FROM platform.tenants
       WHERE slug IN ('rls-termreg-tenant-a', 'rls-termreg-tenant-b')`,
    );
    await appPool.end();
    await adminPool.end();
  });

  it("tenant A only sees its own term registrations", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query("SELECT * FROM app.term_registrations");
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantAId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant B only sees its own term registrations", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const res = await client.query("SELECT * FROM app.term_registrations");
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantBId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant A cannot read tenant B's term registrations with explicit filter", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      // Explicitly filter for tenant B's data — RLS must return 0 rows
      const res = await client.query(
        "SELECT * FROM app.term_registrations WHERE tenant_id = $1",
        [tenantBId],
      );
      await client.query("COMMIT");

      expect(res.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("tenant A cannot insert term registrations belonging to tenant B", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Context set to tenant A
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      // Attempt cross-tenant insert — must be rejected by RLS
      await expect(
        client.query(
          `INSERT INTO app.term_registrations (tenant_id, student_id, academic_year, term)
           VALUES ($1, $2, '2025/2026', 'Term 2')`,
          [tenantBId, studentBId],
        ),
      ).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
