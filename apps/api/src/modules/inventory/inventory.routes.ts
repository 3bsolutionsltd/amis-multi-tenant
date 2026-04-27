import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { notifyIssuanceIssued } from "../../lib/notify.js";
import {
  CreateInventoryItemSchema,
  UpdateInventoryItemSchema,
  InventoryItemQuerySchema,
  CreateStockTransactionSchema,
  StockTransactionQuerySchema,
  CreateIssuanceSchema,
  UpdateIssuanceSchema,
  IssuanceQuerySchema,
  CreateStockTakeSchema,
  UpdateStockTakeSchema,
  StockTakeQuerySchema,
  UpsertStockTakeItemSchema,
} from "./inventory.schema.js";

const READ_ROLES = [
  "admin",
  "registrar",
  "finance",
  "principal",
  "hod",
  "dean",
  "instructor",
  "procurement_officer",
  "inventory_manager",
] as const;

const WRITE_ROLES = ["admin", "registrar", "finance", "inventory_manager", "procurement_officer"] as const;
const ADMIN_ROLES = ["admin", "finance", "inventory_manager"] as const;

const ITEM_COLS =
  "id, item_code, name, description, category, unit_of_measure, reorder_level, current_stock, unit_cost, is_active, notes, created_at, updated_at";

const TXN_COLS =
  "id, item_id, transaction_type, quantity, balance_after, reference_type, reference_id, performed_by, transaction_date, notes, created_at";

const ISSUANCE_COLS =
  "id, issuance_number, issued_to, issued_by, department, requisition_ref, purpose, status, issue_date, return_date, notes, created_at, updated_at";

const ISSUANCE_ITEM_COLS =
  "id, issuance_id, item_id, quantity_requested, quantity_issued, quantity_returned, notes, created_at";

export async function inventoryRoutes(app: FastifyInstance) {
  // ==========================================================================
  // INVENTORY ITEMS
  // ==========================================================================

  app.get("/inventory/items", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = InventoryItemQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, category, low_stock_only, include_inactive, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (!include_inactive) conds.push("is_active = true");
      if (category) { params.push(category); conds.push(`category = $${params.length}`); }
      if (low_stock_only) conds.push("current_stock <= reorder_level");
      if (search) {
        params.push(`%${search}%`);
        conds.push(
          `(name ILIKE $${params.length} OR item_code ILIKE $${params.length} OR description ILIKE $${params.length})`,
        );
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${ITEM_COLS} FROM app.inventory_items ${where} ORDER BY category, name LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/inventory/items", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateInventoryItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.inventory_items
           (tenant_id, item_code, name, description, category, unit_of_measure, reorder_level, unit_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${ITEM_COLS}`,
        [tenantId, d.item_code ?? null, d.name, d.description ?? null, d.category,
         d.unit_of_measure, d.reorder_level, d.unit_cost ?? null, d.notes ?? null],
      );
      return rows[0];
    });

    return reply.status(201).send(row);
  });

  app.get("/inventory/items/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: items } = await client.query(
        `SELECT ${ITEM_COLS} FROM app.inventory_items WHERE id = $1`, [id],
      );
      if (!items[0]) return null;
      // last 20 transactions
      const { rows: txns } = await client.query(
        `SELECT ${TXN_COLS} FROM app.stock_transactions WHERE item_id = $1 ORDER BY transaction_date DESC, created_at DESC LIMIT 20`, [id],
      );
      return { ...items[0], recent_transactions: txns };
    });

    if (!result) return reply.status(404).send({ error: "Item not found" });
    return reply.send(result);
  });

  app.patch("/inventory/items/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdateInventoryItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("item_code", d.item_code);
    addField("name", d.name);
    addField("description", d.description);
    addField("category", d.category);
    addField("unit_of_measure", d.unit_of_measure);
    addField("reorder_level", d.reorder_level);
    addField("unit_cost", d.unit_cost);
    addField("notes", d.notes);
    addField("is_active", d.is_active);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.inventory_items SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${ITEM_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Item not found" });
    return reply.send(row);
  });

  // ==========================================================================
  // STOCK TRANSACTIONS (manual adjustments / receipts)
  // ==========================================================================

  app.get("/inventory/transactions", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = StockTransactionQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { item_id, transaction_type, from_date, to_date, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (item_id) { params.push(item_id); conds.push(`t.item_id = $${params.length}`); }
      if (transaction_type) { params.push(transaction_type); conds.push(`t.transaction_type = $${params.length}`); }
      if (from_date) { params.push(from_date); conds.push(`t.transaction_date >= $${params.length}`); }
      if (to_date) { params.push(to_date); conds.push(`t.transaction_date <= $${params.length}`); }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT t.${TXN_COLS.split(", ").map(c => `t.${c.trim()}`).join(", ")}, i.name AS item_name, i.unit_of_measure
         FROM app.stock_transactions t
         JOIN app.inventory_items i ON t.item_id = i.id
         ${where}
         ORDER BY t.transaction_date DESC, t.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/inventory/transactions", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateStockTransactionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;

    const row = await withTenant(tenantId, async (client) => {
      // Lock the item row and compute new balance
      const { rows: items } = await client.query(
        `SELECT current_stock FROM app.inventory_items WHERE id = $1 FOR UPDATE`, [d.item_id],
      );
      if (!items[0]) throw new Error("Item not found");

      const currentStock = Number(items[0].current_stock);
      const qty = d.transaction_type === "issuance" ? -Math.abs(d.quantity) : Math.abs(d.quantity);
      const balanceAfter = currentStock + qty;

      if (balanceAfter < 0) {
        throw new Error(`Insufficient stock. Available: ${currentStock}, requested: ${Math.abs(d.quantity)}`);
      }

      // Derive reference_type: 'grn' for receipts with a reference, else 'manual'
      const refType = (d.transaction_type === "receipt" && d.reference) ? "grn" : "manual";

      const { rows } = await client.query(
        `INSERT INTO app.stock_transactions
           (tenant_id, item_id, transaction_type, quantity, balance_after, reference_type, reference_id, performed_by, transaction_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${TXN_COLS}`,
        [tenantId, d.item_id, d.transaction_type, qty, balanceAfter,
         refType, d.reference ?? null,
         d.performed_by ?? null, d.transaction_date ?? null, d.notes ?? null],
      );

      // Keep current_stock in sync
      await client.query(
        `UPDATE app.inventory_items SET current_stock = $1, updated_at = now() WHERE id = $2`,
        [balanceAfter, d.item_id],
      );

      return rows[0];
    });

    return reply.status(201).send(row);
  });

  // ==========================================================================
  // STORE ISSUANCES
  // ==========================================================================

  app.get("/inventory/issuances", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = IssuanceQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (status) { params.push(status); conds.push(`status = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(issuance_number ILIKE $${params.length} OR issued_to ILIKE $${params.length})`);
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${ISSUANCE_COLS} FROM app.store_issuances ${where} ORDER BY issue_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/inventory/issuances", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateIssuanceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.store_issuances (tenant_id, issuance_number, issued_to, issued_by, department, requisition_ref, purpose, issue_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${ISSUANCE_COLS}`,
        [tenantId, d.issuance_number, d.issued_to, d.issued_by ?? null, d.department ?? null, d.requisition_ref ?? null, d.purpose ?? null, d.issue_date ?? null, d.notes ?? null],
      );
      const issuance = rows[0];

      for (const item of d.items) {
        await client.query(
          `INSERT INTO app.store_issuance_items (tenant_id, issuance_id, item_id, quantity_requested, quantity_issued, notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [tenantId, issuance.id, item.item_id, item.quantity_requested, item.quantity_issued, item.notes ?? null],
        );
      }

      return issuance;
    });

    return reply.status(201).send(result);
  });

  app.get("/inventory/issuances/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: iss } = await client.query(
        `SELECT ${ISSUANCE_COLS} FROM app.store_issuances WHERE id = $1`, [id],
      );
      if (!iss[0]) return null;
      const { rows: items } = await client.query(
        `SELECT ${ISSUANCE_ITEM_COLS.split(", ").map(c => `si.${c.trim()}`).join(", ")}, i.name AS item_name, i.unit_of_measure
         FROM app.store_issuance_items si
         JOIN app.inventory_items i ON si.item_id = i.id
         WHERE si.issuance_id = $1 ORDER BY si.created_at`, [id],
      );
      return { ...iss[0], items };
    });

    if (!result) return reply.status(404).send({ error: "Issuance not found" });
    return reply.send(result);
  });

  app.patch("/inventory/issuances/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdateIssuanceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("issued_to", d.issued_to);
    addField("issued_by", d.issued_by);
    addField("purpose", d.purpose);
    addField("issue_date", d.issue_date);
    addField("return_date", d.return_date);
    addField("notes", d.notes);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.store_issuances SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${ISSUANCE_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Issuance not found" });
    return reply.send(row);
  });

  // Issue items (transition draft → issued, deduct stock)
  app.post("/inventory/issuances/:id/issue", { preHandler: requireRole(...ADMIN_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const row = await withTenant(tenantId, async (client) => {
      const { rows: iss } = await client.query(
        `SELECT id, status FROM app.store_issuances WHERE id = $1 FOR UPDATE`, [id],
      );
      if (!iss[0]) throw new Error("Issuance not found");
      if (iss[0].status !== "draft") throw new Error("Only draft issuances can be issued");

      // get items to issue
      const { rows: items } = await client.query(
        `SELECT item_id, quantity_issued FROM app.store_issuance_items WHERE issuance_id = $1`, [id],
      );

      // deduct stock for each item
      for (const item of items) {
        if (Number(item.quantity_issued) <= 0) continue;
        const { rows: stockRows } = await client.query(
          `SELECT current_stock FROM app.inventory_items WHERE id = $1 FOR UPDATE`, [item.item_id],
        );
        const currentStock = Number(stockRows[0]?.current_stock ?? 0);
        const qty = Number(item.quantity_issued);
        const balanceAfter = currentStock - qty;
        if (balanceAfter < 0) throw new Error(`Insufficient stock for item ${item.item_id}`);

        await client.query(
          `INSERT INTO app.stock_transactions
             (tenant_id, item_id, transaction_type, quantity, balance_after, reference_type, reference_id, transaction_date)
           VALUES ($1,$2,'issuance',$3,$4,'issuance',$5,CURRENT_DATE)`,
          [tenantId, item.item_id, -qty, balanceAfter, id],
        );
      }

      const { rows: updated } = await client.query(
        `UPDATE app.store_issuances SET status = 'issued', updated_at = now() WHERE id = $1 RETURNING ${ISSUANCE_COLS}`,
        [id],
      );
      return updated[0];
    });

    // fire-and-forget notification to HOD/registrar
    notifyIssuanceIssued(tenantId, {
      id: row.id,
      issuance_number: row.issuance_number,
      issued_to: row.issued_to,
      department: row.department ?? null,
    }).catch(console.error);

    return reply.send(row);
  });

  // ==========================================================================
  // STOCK TAKES
  // ==========================================================================

  const ST_COLS =
    "id, reference, title, financial_year, take_date, status, conducted_by, approved_by, approved_at, notes, created_at, updated_at";

  const ST_ITEM_COLS =
    "id, stock_take_id, item_id, department, expected_qty, counted_qty, condition, notes, created_at";

  app.get("/inventory/stock-takes", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = StockTakeQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { status, financial_year, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (status) { params.push(status); conds.push(`status = $${params.length}`); }
      if (financial_year) { params.push(financial_year); conds.push(`financial_year = $${params.length}`); }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${ST_COLS} FROM app.stock_takes ${where} ORDER BY take_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/inventory/stock-takes", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateStockTakeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.stock_takes (tenant_id, reference, title, financial_year, take_date, conducted_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${ST_COLS}`,
        [tenantId, d.reference, d.title ?? null, d.financial_year ?? null,
         d.take_date ?? null, d.conducted_by ?? null, d.notes ?? null],
      );
      const st = rows[0];

      for (const item of d.items) {
        await client.query(
          `INSERT INTO app.stock_take_items (tenant_id, stock_take_id, item_id, department, expected_qty, counted_qty, condition, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tenantId, st.id, item.item_id, item.department ?? null, item.expected_qty,
           item.counted_qty ?? null, item.condition ?? null, item.notes ?? null],
        );
      }

      return st;
    });

    return reply.status(201).send(result);
  });

  app.get("/inventory/stock-takes/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: sts } = await client.query(
        `SELECT ${ST_COLS} FROM app.stock_takes WHERE id = $1`, [id],
      );
      if (!sts[0]) return null;

      const { rows: items } = await client.query(
        `SELECT sti.${ST_ITEM_COLS.split(", ").map(c => `sti.${c.trim()}`).join(", ")},
                i.name AS item_name, i.item_code, i.unit_of_measure
         FROM app.stock_take_items sti
         JOIN app.inventory_items i ON sti.item_id = i.id
         WHERE sti.stock_take_id = $1
         ORDER BY i.category, i.name`, [id],
      );
      return { ...sts[0], items };
    });

    if (!result) return reply.status(404).send({ error: "Stock take not found" });
    return reply.send(result);
  });

  app.patch("/inventory/stock-takes/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdateStockTakeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("title", d.title);
    addField("financial_year", d.financial_year);
    addField("take_date", d.take_date);
    addField("conducted_by", d.conducted_by);
    addField("approved_by", d.approved_by);
    addField("status", d.status);
    addField("notes", d.notes);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.stock_takes SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${ST_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Stock take not found" });
    return reply.send(row);
  });

  // Upsert a counted item within a stock take
  app.put("/inventory/stock-takes/:id/items", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpsertStockTakeItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.stock_take_items
           (tenant_id, stock_take_id, item_id, department, expected_qty, counted_qty, condition, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (stock_take_id, item_id)
         DO UPDATE SET
           department   = EXCLUDED.department,
           counted_qty  = EXCLUDED.counted_qty,
           expected_qty = EXCLUDED.expected_qty,
           condition    = EXCLUDED.condition,
           notes        = EXCLUDED.notes,
           updated_at   = now()
         RETURNING ${ST_ITEM_COLS}`,
        [tenantId, id, d.item_id, d.department ?? null, d.expected_qty ?? 0,
         d.counted_qty ?? null, d.condition ?? null, d.notes ?? null],
      );
      return rows[0];
    });

    return reply.send(row);
  });

  // Complete a stock take (change status in_progress → completed)
  app.post("/inventory/stock-takes/:id/complete", { preHandler: requireRole(...ADMIN_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const row = await withTenant(tenantId, async (client) => {
      const { rows: sts } = await client.query(
        `SELECT status FROM app.stock_takes WHERE id = $1`, [id],
      );
      if (!sts[0]) return null;
      if (sts[0].status !== "in_progress") {
        throw new Error(`Stock take is already '${sts[0].status}'`);
      }
      const { rows } = await client.query(
        `UPDATE app.stock_takes SET status = 'completed', updated_at = now() WHERE id = $1 RETURNING ${ST_COLS}`,
        [id],
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Stock take not found" });
    return reply.send(row);
  });
}
