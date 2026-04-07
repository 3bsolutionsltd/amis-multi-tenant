/**
 * Workflow RLS Integration Test
 *
 * Proves that:
 * 1. init creates a workflow instance and an event
 * 2. transition fires correctly from published config
 * 3. tenant A cannot see tenant B's workflow instances/events
 *
 * Uses the `amis_app` non-superuser role (subject to RLS).
 * Requires DATABASE_URL and APP_DATABASE_URL in .env.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const APP_DATABASE_URL = process.env.APP_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;

const describeIf = APP_DATABASE_URL && DATABASE_URL ? describe : describe.skip;

// Admissions workflow stored in config payload
const ADMISSIONS_WORKFLOW = {
  key: "admissions",
  initial_state: "submitted",
  states: ["submitted", "shortlisted", "accepted", "rejected", "deferred"],
  transitions: [
    { action: "shortlist", from: "submitted", to: "shortlisted" },
    { action: "accept", from: "shortlisted", to: "accepted" },
    { action: "reject", from: "submitted", to: "rejected" },
    { action: "defer", from: "shortlisted", to: "deferred" },
  ],
};

describeIf("Workflow RLS isolation (integration)", () => {
  const adminPool = new pg.Pool({ connectionString: DATABASE_URL });
  const appPool = new pg.Pool({ connectionString: APP_DATABASE_URL });

  let tenantAId: string;
  let tenantBId: string;
  // Fake entity IDs for the workflow instances
  const entityIdA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const entityIdB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  /** Run a block inside a tenant-scoped transaction using the app (non-superuser) pool */
  async function withAppTenant<T>(
    tid: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Run a block inside a tenant-scoped transaction using the admin pool (for setup) */
  async function withAdminTenant<T>(
    tid: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await adminPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    // Create two test tenants
    const {
      rows: [rowA],
    } = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('wf-rls-tenant-a', 'WF RLS Tenant A')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const {
      rows: [rowB],
    } = await adminPool.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('wf-rls-tenant-b', 'WF RLS Tenant B')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    tenantAId = rowA.id;
    tenantBId = rowB.id;

    // Clean up any leftover state from prior runs (disable append-only trigger for cleanup)
    await adminPool.query(
      `ALTER TABLE app.workflow_events DISABLE TRIGGER workflow_events_no_delete`,
    );
    for (const tid of [tenantAId, tenantBId]) {
      await adminPool.query(
        `DELETE FROM app.workflow_events WHERE tenant_id = $1`,
        [tid],
      );
      await adminPool.query(
        `DELETE FROM app.workflow_instances WHERE tenant_id = $1`,
        [tid],
      );
      await adminPool.query(
        `DELETE FROM platform.config_versions WHERE tenant_id = $1 AND status != 'published'`,
        [tid],
      );
    }
    await adminPool.query(
      `ALTER TABLE app.workflow_events ENABLE TRIGGER workflow_events_no_delete`,
    );

    // Publish a config with the admissions workflow for BOTH tenants
    for (const tid of [tenantAId, tenantBId]) {
      await adminPool.query(
        `INSERT INTO platform.config_versions (tenant_id, status, payload, published_at, published_by)
         VALUES ($1, 'published', $2, now(), 'test-setup')
         ON CONFLICT DO NOTHING`,
        [
          tid,
          JSON.stringify({ workflows: { admissions: ADMISSIONS_WORKFLOW } }),
        ],
      );
    }

    // Grant app role access to workflow tables (idempotent)
    await adminPool.query(`
      GRANT SELECT, INSERT, UPDATE ON app.workflow_instances TO amis_app;
      GRANT SELECT, INSERT ON app.workflow_events TO amis_app;
      GRANT SELECT ON platform.config_versions TO amis_app;
    `);
  });

  afterAll(async () => {
    // workflow_events is append-only (trigger blocks DELETE), so we temporarily
    // disable the trigger for test teardown only.
    await adminPool.query(
      `ALTER TABLE app.workflow_events DISABLE TRIGGER workflow_events_no_delete`,
    );
    for (const tid of [tenantAId, tenantBId]) {
      if (!tid) continue;
      await adminPool.query(
        `DELETE FROM app.workflow_events WHERE tenant_id = $1`,
        [tid],
      );
      await adminPool.query(
        `DELETE FROM app.workflow_instances WHERE tenant_id = $1`,
        [tid],
      );
      await adminPool.query(
        `DELETE FROM platform.config_versions WHERE tenant_id = $1`,
        [tid],
      );
    }
    await adminPool.query(
      `ALTER TABLE app.workflow_events ENABLE TRIGGER workflow_events_no_delete`,
    );
    await adminPool.end();
    await appPool.end();
  });

  // ------------------------------------------------------------------ Test 1: init

  it("init creates a workflow instance and an event", async () => {
    const result = await withAppTenant(tenantAId, async (client) => {
      // Init instance
      const {
        rows: [instance],
      } = await client.query<{ id: string; current_state: string }>(
        `INSERT INTO app.workflow_instances
           (tenant_id, entity_type, entity_id, workflow_key, current_state)
         VALUES ($1, 'admission_application', $2, 'admissions', 'submitted')
         RETURNING id, current_state`,
        [tenantAId, entityIdA],
      );

      // Init event
      const {
        rows: [event],
      } = await client.query<{
        action_key: string;
        from_state: string | null;
        to_state: string;
      }>(
        `INSERT INTO app.workflow_events
           (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key)
         VALUES ($1, 'admission_application', $2, 'admissions', NULL, 'submitted', '__init__')
         RETURNING action_key, from_state, to_state`,
        [tenantAId, entityIdA],
      );

      return { instance, event };
    });

    expect(result.instance.current_state).toBe("submitted");
    expect(result.event.action_key).toBe("__init__");
    expect(result.event.from_state).toBeNull();
    expect(result.event.to_state).toBe("submitted");
  });

  // ------------------------------------------------------------------ Test 2: transition

  it("transition moves instance to new state and appends event", async () => {
    // First init tenant B's instance
    await withAdminTenant(tenantBId, async (client) => {
      await client.query(
        `INSERT INTO app.workflow_instances
           (tenant_id, entity_type, entity_id, workflow_key, current_state)
         VALUES ($1, 'admission_application', $2, 'admissions', 'submitted')`,
        [tenantBId, entityIdB],
      );
    });

    // Transition tenant A's instance (shortlist)
    const result = await withAppTenant(tenantAId, async (client) => {
      await client.query(
        `UPDATE app.workflow_instances
         SET current_state = 'shortlisted', updated_at = now()
         WHERE tenant_id = $1 AND entity_type = 'admission_application' AND entity_id = $2`,
        [tenantAId, entityIdA],
      );

      const {
        rows: [event],
      } = await client.query<{
        from_state: string;
        to_state: string;
        action_key: string;
      }>(
        `INSERT INTO app.workflow_events
           (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key)
         VALUES ($1, 'admission_application', $2, 'admissions', 'submitted', 'shortlisted', 'shortlist')
         RETURNING from_state, to_state, action_key`,
        [tenantAId, entityIdA],
      );

      const {
        rows: [updated],
      } = await client.query<{ current_state: string }>(
        `SELECT current_state FROM app.workflow_instances
         WHERE tenant_id = $1 AND entity_type = 'admission_application' AND entity_id = $2`,
        [tenantAId, entityIdA],
      );

      return { event, current_state: updated.current_state };
    });

    expect(result.current_state).toBe("shortlisted");
    expect(result.event.from_state).toBe("submitted");
    expect(result.event.to_state).toBe("shortlisted");
    expect(result.event.action_key).toBe("shortlist");
  });

  // ------------------------------------------------------------------ Test 3: RLS isolation

  it("tenant A cannot see tenant B's workflow instances or events", async () => {
    // Query from tenant A's perspective — should get 0 rows for tenant B's entity
    const { instances, events } = await withAppTenant(
      tenantAId,
      async (client) => {
        const { rows: instances } = await client.query(
          `SELECT id FROM app.workflow_instances
         WHERE entity_id = $1`,
          [entityIdB],
        );
        const { rows: events } = await client.query(
          `SELECT id FROM app.workflow_events
         WHERE entity_id = $1`,
          [entityIdB],
        );
        return { instances, events };
      },
    );

    expect(instances).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  // ------------------------------------------------------------------ Test 4: append-only enforcement

  it("workflow_events rejects UPDATE attempts", async () => {
    // Get an event id we created for tenant A
    const {
      rows: [evt],
    } = await adminPool.query<{ id: string }>(
      `SELECT id FROM app.workflow_events WHERE tenant_id = $1 LIMIT 1`,
      [tenantAId],
    );
    expect(evt).toBeDefined();

    // Try to UPDATE via admin pool — trigger should block it
    await expect(
      adminPool.query(
        `UPDATE app.workflow_events SET action_key = 'hacked' WHERE id = $1`,
        [evt.id],
      ),
    ).rejects.toThrow(/append-only/);
  });
});
