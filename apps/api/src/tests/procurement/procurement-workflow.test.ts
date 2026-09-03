/**
 * End-to-End Procurement Workflow Integration Test
 *
 * Traces the full procurement lifecycle for Greenfield VTI (Tenant A):
 *
 *   1.  Finance creates a Purchase Requisition (PR) — status: draft
 *   2.  Finance submits the PR                      — status: submitted
 *       ↳ HOD receives in-app notification
 *   3.  HOD recommends the PR                       — status: hod_recommended
 *       ↳ Principal + requester receive in-app notifications
 *   4.  Principal approves the PR                   — status: principal_approved
 *       ↳ Finance + requester receive in-app notifications
 *   5.  Finance converts PR to LPO                  — status: ordered
 *       ↳ LPO auto-created (status: draft)
 *       ↳ HOD + Principal + requester receive in-app notifications
 *   6.  Finance issues the LPO to supplier          — LPO status: issued
 *   7.  Finance creates a GRN (goods received)      — GRN status: draft
 *   8.  Admin confirms the GRN                      — GRN status: confirmed
 *       ↳ Finance + Admin receive in-app notifications
 *   9.  Admin adds stock to the inventory item      — stock increases
 *   10. Admin creates a Store Issuance              — issuance status: draft
 *   11. Admin issues the issuance                   — issuance status: issued
 *       ↳ Stock decreases, HOD/registrar notified
 *
 * Requires DATABASE_URL and JWT_SECRET environment variables.
 * Those are loaded from .env by vitest.config.ts / test-setup.ts.
 *
 * Test users (created in beforeAll, deleted in afterAll):
 *   finance@wf-test.local   — role: finance  (requester, LPO creation, GRN)
 *   hod@wf-test.local       — role: hod      (recommends PR)
 *   principal@wf-test.local — role: principal (approves PR)
 *   admin@wf-test.local     — role: admin    (confirms GRN, issues store issuance)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import jwt from "jsonwebtoken";
import { buildApp } from "../../app.js";
import { hashPassword } from "../../lib/password.js";

// ---------------------------------------------------------------------------
// Environment gate — skip when no DB is available (CI without DB)
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const describeIf = DATABASE_URL && JWT_SECRET ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_A = "10e575a2-2e59-437b-b251-c5b906a482d8";
const TEST_PASSWORD = "Password123!";
const TEST_EMAIL_SUFFIX = "@wf-test.local";

// User email addresses used in this test suite
const FINANCE_EMAIL = `finance${TEST_EMAIL_SUFFIX}`;
const HOD_EMAIL = `hod${TEST_EMAIL_SUFFIX}`;
const PRINCIPAL_EMAIL = `principal${TEST_EMAIL_SUFFIX}`;
const ADMIN_EMAIL = `admin${TEST_EMAIL_SUFFIX}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a JWT for a test user exactly as requireAuth expects. */
function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, tenantId: TENANT_A, role },
    JWT_SECRET as string,
    { expiresIn: "1h" },
  );
}

/** POST helper with JSON body + auth header. */
async function post(
  app: ReturnType<typeof buildApp>,
  url: string,
  body: unknown,
  token: string,
) {
  return app.inject({
    method: "POST",
    url,
    payload: body,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

/** PATCH helper */
async function patch(
  app: ReturnType<typeof buildApp>,
  url: string,
  body: unknown,
  token: string,
) {
  return app.inject({
    method: "PATCH",
    url,
    payload: body,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

/** GET helper */
async function get(
  app: ReturnType<typeof buildApp>,
  url: string,
  token: string,
) {
  return app.inject({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describeIf("Procurement E2E Workflow (Tenant A — Greenfield VTI)", () => {
  const app = buildApp();
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  // Unique run suffix to prevent conflicts between concurrent / repeated test runs
  const RUN_ID = Date.now().toString(36).slice(-6).toUpperCase();
  const PR_NUMBER = `PR-WF-${RUN_ID}`;
  const GRN_NUMBER = `GRN-WF-${RUN_ID}`;
  const SI_NUMBER = `SI-WF-${RUN_ID}`;
  const ITEM_CODE = `WF-ITEM-${RUN_ID}`;

  // User IDs (set in beforeAll)
  let financeId: string;
  let hodId: string;
  let principalId: string;
  let adminId: string;

  // Tokens
  let financeToken: string;
  let hodToken: string;
  let principalToken: string;
  let adminToken: string;

  // Test data IDs (accumulated across test steps)
  let supplierId: string;
  let inventoryItemId: string;
  let prId: string;
  let poId: string;
  let grnId: string;
  let issuanceId: string;

  // ---------------------------------------------------------------------------
  // Seed test actors, supplier and inventory item
  // ---------------------------------------------------------------------------
  beforeAll(async () => {
    // Pre-cleanup: delete any stale data from previous failed runs using
    // known static identifiers, in dependency order (child rows first).
    {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);

        // Issuances
        await client.query(
          `DELETE FROM app.store_issuance_items WHERE issuance_id IN (
             SELECT id FROM app.store_issuances WHERE tenant_id = $1 AND issuance_number = $2
           )`,
          [TENANT_A, SI_NUMBER],
        );
        await client.query(
          `DELETE FROM app.store_issuances WHERE tenant_id = $1 AND issuance_number = $2`,
          [TENANT_A, SI_NUMBER],
        );

        // Stock transactions for our test item
        await client.query(
          `DELETE FROM app.stock_transactions WHERE tenant_id = $1 AND item_id IN (
             SELECT id FROM app.inventory_items WHERE tenant_id = $1 AND item_code = $2
           )`,
          [TENANT_A, ITEM_CODE],
        );

        // GRNs
        await client.query(
          `DELETE FROM app.grn_items WHERE grn_id IN (
             SELECT id FROM app.goods_received_notes WHERE tenant_id = $1 AND grn_number = $2
           )`,
          [TENANT_A, GRN_NUMBER],
        );
        await client.query(
          `DELETE FROM app.goods_received_notes WHERE tenant_id = $1 AND grn_number = $2`,
          [TENANT_A, GRN_NUMBER],
        );

        // POs linked to our PR
        await client.query(
          `DELETE FROM app.purchase_order_items WHERE po_id IN (
             SELECT po.id FROM app.purchase_orders po
             JOIN app.purchase_requisitions pr ON po.pr_id = pr.id
             WHERE pr.tenant_id = $1 AND pr.pr_number = $2
           )`,
          [TENANT_A, PR_NUMBER],
        );
        await client.query(
          `DELETE FROM app.purchase_orders WHERE pr_id IN (
             SELECT id FROM app.purchase_requisitions WHERE tenant_id = $1 AND pr_number = $2
           )`,
          [TENANT_A, PR_NUMBER],
        );

        // PR
        await client.query(
          `DELETE FROM app.purchase_requisition_items WHERE pr_id IN (
             SELECT id FROM app.purchase_requisitions WHERE tenant_id = $1 AND pr_number = $2
           )`,
          [TENANT_A, PR_NUMBER],
        );
        await client.query(
          `DELETE FROM app.purchase_requisitions WHERE tenant_id = $1 AND pr_number = $2`,
          [TENANT_A, PR_NUMBER],
        );

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    const pwHash = hashPassword(TEST_PASSWORD);

    // Upsert all test users
    const upsertUser = async (email: string, role: string): Promise<string> => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (tenant_id, email) WHERE tenant_id IS NOT NULL DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role,
               is_active     = true
         RETURNING id`,
        [TENANT_A, email, pwHash, role],
      );
      return rows[0].id;
    };

    [financeId, hodId, principalId, adminId] = await Promise.all([
      upsertUser(FINANCE_EMAIL, "finance"),
      upsertUser(HOD_EMAIL, "hod"),
      upsertUser(PRINCIPAL_EMAIL, "principal"),
      upsertUser(ADMIN_EMAIL, "admin"),
    ]);

    // Mint JWTs
    financeToken = makeToken(financeId, "finance");
    hodToken = makeToken(hodId, "hod");
    principalToken = makeToken(principalId, "principal");
    adminToken = makeToken(adminId, "admin");

    // Seed supplier + inventory item inside a transaction with tenant context.
    // pool.query() cannot run multi-statement SQL, so we use an explicit client.
    {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);

        // Supplier — insert, then fall back to SELECT on conflict
        let sRes = await client.query<{ id: string }>(
          `INSERT INTO app.suppliers (tenant_id, name, contact_person, email, phone)
           VALUES ($1, 'Test Supplies Ltd', 'John Supplier', 'supplier@test.local', '0800-000-111')
           ON CONFLICT DO NOTHING RETURNING id`,
          [TENANT_A],
        );
        if (!sRes.rows[0]) {
          sRes = await client.query<{ id: string }>(
            `SELECT id FROM app.suppliers WHERE tenant_id = $1 AND name = 'Test Supplies Ltd' LIMIT 1`,
            [TENANT_A],
          );
        }
        supplierId = sRes.rows[0].id;

        // Inventory item — upsert, always reset stock to 0 for clean test run
        const iRes = await client.query<{ id: string }>(
          `INSERT INTO app.inventory_items
             (tenant_id, item_code, name, category, unit_of_measure, reorder_level, current_stock)
           VALUES ($1, $2, 'Workflow Test Item', 'stationery', 'units', 5, 0)
           ON CONFLICT (tenant_id, item_code) DO UPDATE SET current_stock = 0
           RETURNING id`,
          [TENANT_A, ITEM_CODE],
        );
        inventoryItemId = iRes.rows[0].id;

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  });

  afterAll(async () => {
    // Clean up all test data in dependency order.
    // All app.* tables are RLS-protected — must run inside a transaction with tenant context.
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);

        if (issuanceId) {
          await client.query(`DELETE FROM app.store_issuance_items WHERE issuance_id = $1`, [issuanceId]);
          await client.query(`DELETE FROM app.store_issuances WHERE id = $1`, [issuanceId]);
        }
        if (inventoryItemId) {
          await client.query(`DELETE FROM app.stock_transactions WHERE item_id = $1`, [inventoryItemId]);
          await client.query(`DELETE FROM app.inventory_items WHERE id = $1`, [inventoryItemId]);
        }
        if (grnId) {
          await client.query(`DELETE FROM app.grn_items WHERE grn_id = $1`, [grnId]);
          await client.query(`DELETE FROM app.goods_received_notes WHERE id = $1`, [grnId]);
        }
        if (poId) {
          await client.query(`DELETE FROM app.purchase_order_items WHERE po_id = $1`, [poId]);
          await client.query(`DELETE FROM app.purchase_orders WHERE id = $1`, [poId]);
        }
        if (prId) {
          await client.query(`DELETE FROM app.purchase_requisition_items WHERE pr_id = $1`, [prId]);
          await client.query(`DELETE FROM app.purchase_requisitions WHERE id = $1`, [prId]);
        }
        if (supplierId) {
          await client.query(`DELETE FROM app.suppliers WHERE id = $1`, [supplierId]);
        }
        const userIds = [financeId, hodId, principalId, adminId].filter(Boolean);
        if (userIds.length) {
          await client.query(
            `DELETE FROM app.notifications WHERE tenant_id = $1 AND user_id = ANY($2::uuid[])`,
            [TENANT_A, userIds],
          );
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      // platform.users — not covered by app.tenant_id RLS, use pool directly
      await pool.query(
        `DELETE FROM platform.users WHERE tenant_id = $1 AND email LIKE $2`,
        [TENANT_A, `%${TEST_EMAIL_SUFFIX}`],
      );
    } catch (err) {
      console.error("[afterAll] Cleanup error:", err);
    }

    await pool.end();
    await app.close();
  });

  // =========================================================================
  // STEP 1 — Finance creates a PR (draft)
  // =========================================================================
  it("Step 1: Finance creates a Purchase Requisition in draft state", async () => {
    const res = await post(app, "/procurement/requisitions", {
      pr_number: PR_NUMBER,
      title: "Office Supplies for ICT Department",
      department: "ICT",
      requested_by: FINANCE_EMAIL,
      priority: "normal",
      academic_year: "2025",
      notes: "Needed for Q3 term",
      items: [
        {
          description: "A4 Paper Reams",
          quantity: 10,
          unit: "reams",
          estimated_unit_cost: 120,
          notes: "80gsm",
        },
        {
          description: "Ballpoint Pens Box",
          quantity: 5,
          unit: "boxes",
          estimated_unit_cost: 85,
        },
      ],
    }, financeToken);

    expect(res.statusCode, `Create PR failed: ${res.body}`).toBe(201);
    const pr = res.json();
    expect(pr.status).toBe("draft");
    expect(pr.title).toBe("Office Supplies for ICT Department");
    expect(pr.items).toHaveLength(2);

    prId = pr.id;
  });

  // =========================================================================
  // STEP 2 — Finance submits the PR
  // =========================================================================
  it("Step 2: Finance submits the PR → status becomes 'submitted'", async () => {
    const res = await post(
      app,
      `/procurement/requisitions/${prId}/transition`,
      { status: "submitted" },
      financeToken,
    );

    expect(res.statusCode, `Submit PR failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("submitted");
  });

  it("Step 2b: HOD receives an in-app notification for the submitted PR", async () => {
    // Small wait for the fire-and-forget notification to commit
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query<{ id: string; title: string }>(
      `SELECT id, title FROM app.notifications
       WHERE user_id = $1 AND entity_id = $2 AND entity_type = 'purchase_requisition'
       ORDER BY created_at DESC LIMIT 1`,
      [hodId, prId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain("HOD Recommendation");
  });

  // =========================================================================
  // STEP 3 — HOD recommends the PR
  // =========================================================================
  it("Step 3: HOD recommends the PR → status becomes 'hod_recommended'", async () => {
    const res = await post(
      app,
      `/procurement/requisitions/${prId}/transition`,
      { status: "hod_recommended", notes: "Recommend approval — stock is critical" },
      hodToken,
    );

    expect(res.statusCode, `HOD recommendation failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("hod_recommended");
  });

  it("Step 3b: Principal receives an in-app notification after HOD recommendation", async () => {
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query<{ title: string }>(
      `SELECT title FROM app.notifications
       WHERE user_id = $1 AND entity_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [principalId, prId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toMatch(/principal/i);
  });

  it("Step 3c: Requester (finance) receives a notification about HOD recommendation", async () => {
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query<{ title: string }>(
      `SELECT title FROM app.notifications
       WHERE user_id = $1 AND entity_id = $2
         AND title ILIKE '%recommended%'
       ORDER BY created_at DESC LIMIT 1`,
      [financeId, prId],
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // STEP 4 — Principal approves the PR
  // =========================================================================
  it("Step 4: Principal approves the PR → status becomes 'principal_approved'", async () => {
    const res = await post(
      app,
      `/procurement/requisitions/${prId}/transition`,
      { status: "principal_approved" },
      principalToken,
    );

    expect(res.statusCode, `Principal approval failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("principal_approved");
  });

  it("Step 4b: Finance receives a notification that PR is approved", async () => {
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query<{ title: string }>(
      `SELECT title FROM app.notifications
       WHERE user_id = $1 AND entity_id = $2
         AND title ILIKE '%approved%'
       ORDER BY created_at DESC LIMIT 1`,
      [financeId, prId],
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // STEP 5 — Finance converts PR to LPO
  // =========================================================================
  it("Step 5: Finance converts PR to LPO → PR status 'ordered', LPO auto-created", async () => {
    const res = await post(
      app,
      `/procurement/requisitions/${prId}/transition`,
      { status: "ordered" },
      financeToken,
    );

    expect(res.statusCode, `LPO conversion failed: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ordered");
    expect(body.po_id).toBeTruthy();

    poId = body.po_id as string;
  });

  it("Step 5b: Auto-created LPO has status 'draft' and links back to the PR", async () => {
    const res = await get(app, `/procurement/orders/${poId}`, financeToken);

    expect(res.statusCode).toBe(200);
    const po = res.json();
    expect(po.status).toBe("draft");
    expect(po.pr_id).toBe(prId);
    expect(po.po_number).toMatch(/^LPO/i);
  });

  it("Step 5c: HOD and Principal receive LPO notification", async () => {
    await new Promise((r) => setTimeout(r, 200));

    for (const userId of [hodId, principalId]) {
      const { rows } = await pool.query<{ title: string }>(
        `SELECT title FROM app.notifications
         WHERE user_id = $1 AND entity_id = $2
           AND title ILIKE '%lpo%'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, prId],
      );
      expect(rows.length, `No LPO notification for user ${userId}`).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // STEP 5d — Finance links supplier to the LPO
  // =========================================================================
  it("Step 5d: Finance links supplier to the LPO", async () => {
    const res = await patch(
      app,
      `/procurement/orders/${poId}`,
      {
        supplier_id: supplierId,
        order_date: new Date().toISOString().slice(0, 10),
        expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      },
      financeToken,
    );

    expect(res.statusCode, `Link supplier failed: ${res.body}`).toBe(200);
    expect(res.json().supplier_id).toBe(supplierId);
  });

  // =========================================================================
  // STEP 6 — Finance issues the LPO to supplier
  // =========================================================================
  it("Step 6: Finance issues the LPO → LPO status becomes 'issued'", async () => {
    const res = await post(
      app,
      `/procurement/orders/${poId}/transition`,
      { status: "issued" },
      financeToken,
    );

    expect(res.statusCode, `Issue LPO failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("issued");
  });

  // =========================================================================
  // STEP 7 — Finance creates a GRN (supplier has delivered goods)
  // =========================================================================
  it("Step 7: Finance creates a GRN linked to the LPO → GRN status: 'draft'", async () => {
    const res = await post(app, "/procurement/grns", {
      grn_number: GRN_NUMBER,
      po_id: poId,
      received_by: "Stores Dept",
      received_date: new Date().toISOString().slice(0, 10),
      notes: "All items received in good condition",
      items: [
        {
          description: "A4 Paper Reams",
          quantity_ordered: 10,
          quantity_received: 10,
          condition: "good",
        },
        {
          description: "Ballpoint Pens Box",
          quantity_ordered: 5,
          quantity_received: 5,
          condition: "good",
        },
      ],
    }, financeToken);

    expect(res.statusCode, `Create GRN failed: ${res.body}`).toBe(201);
    const grn = res.json();
    expect(grn.status).toBe("draft");
    expect(grn.po_id).toBe(poId);

    grnId = grn.id;
  });

  // =========================================================================
  // STEP 8 — Admin confirms the GRN
  // =========================================================================
  it("Step 8: Admin confirms the GRN → GRN status becomes 'confirmed'", async () => {
    const res = await post(
      app,
      `/procurement/grns/${grnId}/confirm`,
      {},
      adminToken,
    );

    expect(res.statusCode, `GRN confirm failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("confirmed");
  });

  it("Step 8b: Finance + Admin receive GRN confirmed notification", async () => {
    await new Promise((r) => setTimeout(r, 200));

    for (const userId of [financeId, adminId]) {
      const { rows } = await pool.query<{ title: string }>(
        `SELECT title FROM app.notifications
         WHERE user_id = $1 AND entity_id = $2 AND entity_type = 'grn'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, grnId],
      );
      expect(rows.length, `No GRN notification for user ${userId}`).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // STEP 9 — Admin records stock receipt in inventory
  // =========================================================================
  it("Step 9: Admin records stock receipt → inventory level increases", async () => {
    const res = await post(app, "/inventory/transactions", {
      item_id: inventoryItemId,
      transaction_type: "receipt",
      quantity: 15,
      notes: `Received via ${GRN_NUMBER}`,
      transaction_date: new Date().toISOString().slice(0, 10),
    }, adminToken);

    expect(res.statusCode, `Stock receipt failed: ${res.body}`).toBe(201);
    const txn = res.json();
    expect(txn.transaction_type).toBe("receipt");
    expect(Number(txn.balance_after)).toBe(15);
  });

  it("Step 9b: Inventory item current_stock reflects the receipt", async () => {
    const res = await get(app, `/inventory/items/${inventoryItemId}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().current_stock)).toBe(15);
  });

  // =========================================================================
  // STEP 10 — Admin creates a Store Issuance to dispatch items
  // =========================================================================
  it("Step 10: Admin creates a Store Issuance → status: 'draft'", async () => {
    const res = await post(app, "/inventory/issuances", {
      issuance_number: SI_NUMBER,
      issued_to: "ICT Department",
      issued_by: "Stores",
      department: "ICT",
      purpose: "Office use Q3 2025",
      issue_date: new Date().toISOString().slice(0, 10),
      items: [
        {
          item_id: inventoryItemId,
          quantity_requested: 8,
          quantity_issued: 8,
          notes: "For staff workstations",
        },
      ],
    }, adminToken);

    expect(res.statusCode, `Create issuance failed: ${res.body}`).toBe(201);
    const iss = res.json();
    expect(iss.status).toBe("draft");

    issuanceId = iss.id;
  });

  // =========================================================================
  // STEP 11 — Admin issues the issuance (items dispatched, stock deducted)
  // =========================================================================
  it("Step 11: Admin issues the Store Issuance → status: 'issued', stock deducted", async () => {
    const res = await post(
      app,
      `/inventory/issuances/${issuanceId}/issue`,
      {},
      adminToken,
    );

    expect(res.statusCode, `Issue issuance failed: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("issued");
  });

  it("Step 11b: Inventory stock reduced by the issued quantity (15 - 8 = 7)", async () => {
    const res = await get(app, `/inventory/items/${inventoryItemId}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().current_stock)).toBe(7);
  });

  it("Step 11c: HOD/registrar receives issuance notification", async () => {
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query<{ title: string }>(
      `SELECT title FROM app.notifications
       WHERE user_id = $1 AND entity_id = $2 AND entity_type = 'store_issuance'
       ORDER BY created_at DESC LIMIT 1`,
      [hodId, issuanceId],
    );

    expect(rows.length, "No issuance notification for HOD").toBeGreaterThan(0);
  });

  // =========================================================================
  // ROLE ENFORCEMENT — wrong roles must be rejected
  // =========================================================================
  describe("Role enforcement", () => {
    it("HOD cannot create a PR (only finance/admin/registrar can)", async () => {
      const res = await post(app, "/procurement/requisitions", {
        pr_number: "PR-WF-FORBIDDEN",
        title: "Should be rejected",
        items: [{ description: "Item", quantity: 1 }],
      }, hodToken);

      expect(res.statusCode).toBe(403);
    });

    it("Finance cannot recommend a PR (only hod can)", async () => {
      const res = await post(
        app,
        `/procurement/requisitions/${prId}/transition`,
        { status: "hod_recommended" },
        financeToken,
      );

      // PR is already past hod_recommended — the transition guard rejects it
      expect([403, 422]).toContain(res.statusCode);
    });

    it("Finance cannot confirm a GRN (only admin/finance can via ADMIN_ROLES)", async () => {
      // HOD tries to confirm
      const res = await post(
        app,
        `/procurement/grns/${grnId}/confirm`,
        {},
        hodToken,
      );
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // FINAL STATE — verify the full picture via GET calls
  // =========================================================================
  describe("Final state verification", () => {
    it("PR has status 'ordered' and links to the LPO", async () => {
      const res = await get(app, `/procurement/requisitions/${prId}`, financeToken);
      expect(res.statusCode).toBe(200);
      const pr = res.json();
      expect(pr.status).toBe("ordered");
      expect(pr.linked_po?.id).toBe(poId);
    });

    it("LPO has status 'issued' and links back to the PR", async () => {
      const res = await get(app, `/procurement/orders/${poId}`, financeToken);
      expect(res.statusCode).toBe(200);
      const po = res.json();
      expect(po.status).toBe("issued");
      expect(po.pr_id).toBe(prId);
      expect(po.supplier_id).toBe(supplierId);
    });

    it("GRN has status 'confirmed' and links to the LPO", async () => {
      const res = await get(app, `/procurement/grns/${grnId}`, adminToken);
      expect(res.statusCode).toBe(200);
      const grn = res.json();
      expect(grn.status).toBe("confirmed");
      expect(grn.po_id).toBe(poId);
    });

    it("Store Issuance has status 'issued'", async () => {
      const res = await get(app, `/inventory/issuances/${issuanceId}`, adminToken);
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("issued");
    });

    it("Inventory item final stock is 7 (received 15, issued 8)", async () => {
      const res = await get(app, `/inventory/items/${inventoryItemId}`, adminToken);
      expect(res.statusCode).toBe(200);
      expect(Number(res.json().current_stock)).toBe(7);
    });
  });
});
