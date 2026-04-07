/**
 * RLS Isolation Integration Test — Payments
 *
 * Proves that tenant A cannot read tenant B's payments through
 * Postgres RLS. Uses the `amis_app` non-superuser role (subject to RLS policy).
 * Requires APP_DATABASE_URL to be set (see .env).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const APP_DATABASE_URL = process.env.APP_DATABASE_URL;

const describeIf = APP_DATABASE_URL ? describe : describe.skip;

describeIf("RLS isolation — fees (integration)", () => {
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });
  const adminPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const resA = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-fees-tenant-a', 'RLS Fees Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const resB = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('rls-fees-tenant-b', 'RLS Fees Tenant B')
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
      // Seed tenant A payments (superuser bypasses RLS)
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      await adminClient.query(
        `INSERT INTO app.payments
           (tenant_id, student_id, amount, currency, reference, paid_at, source)
         VALUES
           ($1, gen_random_uuid(), 5000, 'ZAR', 'REF-A-1', now(), 'manual'),
           ($1, gen_random_uuid(), 3000, 'ZAR', 'REF-A-2', now(), 'manual')`,
        [tenantAId],
      );
      await adminClient.query("COMMIT");

      // Seed tenant B payments
      await adminClient.query("BEGIN");
      await adminClient.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      await adminClient.query(
        `INSERT INTO app.payments
           (tenant_id, student_id, amount, currency, reference, paid_at, source)
         VALUES ($1, gen_random_uuid(), 7000, 'ZAR', 'REF-B-1', now(), 'manual')`,
        [tenantBId],
      );
      await adminClient.query("COMMIT");
    } finally {
      adminClient.release();
    }
  });

  afterAll(async () => {
    await adminPool.query(
      `DELETE FROM platform.tenants WHERE slug IN ('rls-fees-tenant-a', 'rls-fees-tenant-b')`,
    );
    await appPool.end();
    await adminPool.end();
  });

  it("tenant A only sees its own payments", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query("SELECT * FROM app.payments");
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantAId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant B only sees its own payments", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantBId,
      ]);
      const res = await client.query("SELECT * FROM app.payments");
      await client.query("COMMIT");

      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(tenantBId);
      }
    } finally {
      client.release();
    }
  });

  it("tenant A cannot see tenant B payments", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantAId,
      ]);
      const res = await client.query(
        "SELECT * FROM app.payments WHERE tenant_id = $1",
        [tenantBId],
      );
      await client.query("COMMIT");

      expect(res.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });
});
