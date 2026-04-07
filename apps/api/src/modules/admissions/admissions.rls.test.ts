/**
 * RLS Isolation Integration Test — Admissions Applications
 *
 * Proves that tenant A cannot read tenant B's admission_applications through
 * Postgres RLS. Uses the `amis_app` non-superuser role (subject to RLS policy).
 * Requires APP_DATABASE_URL to be set (see .env).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const APP_DATABASE_URL = process.env.APP_DATABASE_URL;

const describeIf = APP_DATABASE_URL ? describe : describe.skip;

describeIf("RLS isolation — admissions (integration)", () => {
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });
  const adminPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const resA = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-adm-tenant-a', 'RLS Adm Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const resB = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-adm-tenant-b', 'RLS Adm Tenant B')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );

    tenantAId = resA.rows[0].id;
    tenantBId = resB.rows[0].id;

    await adminPool.query(
      `GRANT USAGE ON SCHEMA app TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO amis_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;`,
    );

    const adminClient = await adminPool.connect();
    try {
      // Seed tenant A applications
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      await adminClient.query(
        `INSERT INTO app.admission_applications
           (tenant_id, first_name, last_name, programme, intake)
         VALUES
           ($1, 'Alice', 'RLS-A', 'CS', '2026-01'),
           ($1, 'Bob',   'RLS-A', 'IT', '2026-01')`,
        [tenantAId],
      );
      await adminClient.query("COMMIT");

      // Seed tenant B applications
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      await adminClient.query(
        `INSERT INTO app.admission_applications
           (tenant_id, first_name, last_name, programme, intake)
         VALUES ($1, 'Carol', 'RLS-B', 'Law', '2026-02')`,
        [tenantBId],
      );
      await adminClient.query("COMMIT");
    } finally {
      adminClient.release();
    }
  });

  afterAll(async () => {
    await adminPool.query(
      `DELETE FROM platform.tenants WHERE slug IN ('rls-adm-tenant-a', 'rls-adm-tenant-b')`,
    );
    await appPool.end();
    await adminPool.end();
  });

  it("tenant A only sees its own applications", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query(
        "SELECT * FROM app.admission_applications",
      );
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantAId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant B only sees its own applications", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const res = await client.query(
        "SELECT * FROM app.admission_applications",
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

  it("tenant A cannot see tenant B application by querying all rows", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query(
        "SELECT * FROM app.admission_applications",
      );
      await client.query("COMMIT");

      const tenantBRows = res.rows.filter((r) => r.tenant_id === tenantBId);
      expect(tenantBRows).toHaveLength(0);
    } finally {
      client.release();
    }
  });
});
