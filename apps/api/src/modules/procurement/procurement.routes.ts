import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
import { notifyPRTransition, notifyGRNConfirmed } from "../../lib/notify.js";
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  SupplierQuerySchema,
  CreatePRSchema,
  UpdatePRSchema,
  PRItemSchema,
  PRQuerySchema,
  TransitionPRSchema,
  CreatePOSchema,
  UpdatePOSchema,
  POQuerySchema,
  TransitionPOSchema,
  CreateGRNSchema,
  UpdateGRNSchema,
  GRNQuerySchema,
} from "./procurement.schema.js";

const READ_ROLES = [
  "admin",
  "registrar",
  "finance",
  "principal",
  "hod",
  "dean",
  "procurement_officer",
  "inventory_manager",
] as const;

const WRITE_ROLES = ["admin", "registrar", "finance", "procurement_officer"] as const;
const ADMIN_ROLES = ["admin", "finance", "procurement_officer"] as const;

const SUPPLIER_COLS =
  "id, name, contact_person, email, phone, address, tin_number, is_active, notes, created_at, updated_at";

const PR_COLS =
  "id, pr_number, title, department, requested_by, recommended_by, recommended_at, approved_by, approved_at, priority, status, academic_year, required_by, notes, created_at, updated_at";

const PR_ITEM_COLS =
  "id, pr_id, description, vote_item, quantity, unit, estimated_unit_cost, notes, created_at";

const PO_COLS =
  "id, po_number, pr_id, supplier_id, title, status, order_date, expected_delivery_date, total_amount, notes, created_at, updated_at";

const PO_ITEM_COLS =
  "id, po_id, description, quantity, unit, unit_price, total_price, notes, created_at";

const GRN_COLS =
  "id, grn_number, po_id, received_by, received_date, status, notes, created_at, updated_at";

const GRN_ITEM_COLS =
  "id, grn_id, po_item_id, description, quantity_ordered, quantity_received, condition, notes, created_at";

export async function procurementRoutes(app: FastifyInstance) {
  // ==========================================================================
  // SUPPLIERS
  // ==========================================================================

  app.get("/procurement/suppliers", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = SupplierQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, include_inactive, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (!include_inactive) conds.push("is_active = true");
      if (search) {
        params.push(`%${search}%`);
        conds.push(
          `(name ILIKE $${params.length} OR contact_person ILIKE $${params.length} OR email ILIKE $${params.length})`,
        );
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${SUPPLIER_COLS} FROM app.suppliers ${where} ORDER BY name LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/procurement/suppliers", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateSupplierSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.suppliers (tenant_id, name, contact_person, email, phone, address, tin_number, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${SUPPLIER_COLS}`,
        [tenantId, d.name, d.contact_person ?? null, d.email ?? null, d.phone ?? null, d.address ?? null, d.tin_number ?? null, d.notes ?? null],
      );
      return rows[0];
    });

    return reply.status(201).send(row);
  });

  app.get("/procurement/suppliers/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT ${SUPPLIER_COLS} FROM app.suppliers WHERE id = $1`,
        [id],
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Supplier not found" });
    return reply.send(row);
  });

  app.patch("/procurement/suppliers/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdateSupplierSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };

    addField("name", d.name);
    addField("contact_person", d.contact_person);
    addField("email", d.email);
    addField("phone", d.phone);
    addField("address", d.address);
    addField("tin_number", d.tin_number);
    addField("notes", d.notes);
    addField("is_active", d.is_active);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.suppliers SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${SUPPLIER_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Supplier not found" });
    return reply.send(row);
  });

  // ==========================================================================
  // PURCHASE REQUISITIONS
  // ==========================================================================

  app.get("/procurement/requisitions", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = PRQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, status, department, academic_year, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (status) { params.push(status); conds.push(`status = $${params.length}`); }
      if (department) { params.push(department); conds.push(`department = $${params.length}`); }
      if (academic_year) { params.push(academic_year); conds.push(`academic_year = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(title ILIKE $${params.length} OR pr_number ILIKE $${params.length} OR requested_by ILIKE $${params.length})`);
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${PR_COLS} FROM app.purchase_requisitions ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/procurement/requisitions", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreatePRSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.purchase_requisitions
           (tenant_id, pr_number, title, department, requested_by, priority, academic_year, required_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${PR_COLS}`,
        [tenantId, d.pr_number, d.title, d.department ?? null, d.requested_by ?? null,
         d.priority, d.academic_year ?? null, d.required_by ?? null, d.notes ?? null],
      );
      const pr = rows[0];

      if (d.items.length) {
        for (const item of d.items) {
          await client.query(
            `INSERT INTO app.purchase_requisition_items
               (tenant_id, pr_id, description, vote_item, quantity, unit, estimated_unit_cost, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [tenantId, pr.id, item.description, item.vote_item ?? null, item.quantity, item.unit, item.estimated_unit_cost ?? null, item.notes ?? null],
          );
        }
      }

      const { rows: items } = await client.query(
        `SELECT ${PR_ITEM_COLS} FROM app.purchase_requisition_items WHERE pr_id = $1 ORDER BY created_at`, [pr.id],
      );
      return { ...pr, items };
    });

    return reply.status(201).send(result);
  });

  app.get("/procurement/requisitions/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: prs } = await client.query(
        `SELECT ${PR_COLS} FROM app.purchase_requisitions WHERE id = $1`, [id],
      );
      if (!prs[0]) return null;
      const { rows: items } = await client.query(
        `SELECT ${PR_ITEM_COLS} FROM app.purchase_requisition_items WHERE pr_id = $1 ORDER BY created_at`, [id],
      );
      // Include the linked LPO id (if one was auto-created for this PR)
      const { rows: linkedPO } = await client.query<{ id: string; po_number: string }>(
        `SELECT id, po_number FROM app.purchase_orders WHERE pr_id = $1 ORDER BY created_at LIMIT 1`, [id],
      );
      return { ...prs[0], items, linked_po: linkedPO[0] ?? null };
    });

    if (!result) return reply.status(404).send({ error: "Requisition not found" });
    return reply.send(result);
  });

  app.patch("/procurement/requisitions/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdatePRSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("title", d.title);
    addField("department", d.department);
    addField("requested_by", d.requested_by);
    addField("priority", d.priority);
    addField("academic_year", d.academic_year);
    addField("required_by", d.required_by);
    addField("notes", d.notes);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.purchase_requisitions SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${PR_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Requisition not found" });
    return reply.send(row);
  });

  app.post("/procurement/requisitions/:id/transition", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId, userId, role: actorRole } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = TransitionPRSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const result = await withTenant(tenantId, async (client) => {
      // Load the workflow definition (tenant config or built-in default)
      const wf = await loadWorkflowDef(tenantId, "purchase_requisition", client);

      const { rows: current } = await client.query<{ status: string }>(
        `SELECT status FROM app.purchase_requisitions WHERE id = $1`, [id],
      );
      if (!current[0]) return null;

      const currentStatus = current[0].status;
      const newStatus = parsed.data.status;

      // Find the matching transition in the workflow definition
      const transition = wf
        ? wf.transitions.find((t) => t.from === currentStatus && t.to === newStatus)
        : null;

      // If workflow def loaded, validate via it; otherwise fall back to hard-coded list
      const FALLBACK_VALID: Record<string, string[]> = {
        draft: ["submitted", "rejected"],
        submitted: ["hod_recommended", "rejected"],
        hod_recommended: ["principal_approved", "rejected"],
        principal_approved: ["ordered", "rejected"],
        rejected: ["closed"],
        ordered: ["closed"],
      };

      const isValidTransition = wf
        ? !!transition
        : (FALLBACK_VALID[currentStatus] ?? []).includes(newStatus);

      if (!isValidTransition) {
        return { _invalid: `Cannot transition from '${currentStatus}' to '${newStatus}'` } as const;
      }

      // Enforce role constraint from workflow definition
      if (transition?.required_role) {
        if (actorRole !== transition.required_role && actorRole !== "admin" && actorRole !== "platform_admin") {
          return { _forbidden: `Role '${transition.required_role}' required for this transition` } as const;
        }
      }

      // Build the UPDATE with correct parameter indexing
      const params: unknown[] = [newStatus]; // $1 = new status
      const extraFields: string[] = [];

      if (newStatus === "hod_recommended") {
        params.push(userId ?? null);                                  // $2
        extraFields.push(`recommended_by = $${params.length}`);
        extraFields.push(`recommended_at = now()`);
      } else if (newStatus === "principal_approved") {
        params.push(userId ?? null);                                  // $2
        extraFields.push(`approved_by = $${params.length}`);
        extraFields.push(`approved_at = now()`);
      }

      const extra = extraFields.length ? `, ${extraFields.join(", ")}` : "";
      params.push(id); // last: WHERE clause ($2 or $3)

      const { rows } = await client.query(
        `UPDATE app.purchase_requisitions SET status = $1${extra}, updated_at = now() WHERE id = $${params.length} RETURNING ${PR_COLS}`,
        params,
      );
      const row = rows[0] ?? null;
      if (!row) return null;

      // ── Auto-create a draft LPO when PR moves to "ordered" ──────────────
      let po_id: string | undefined;
      if (newStatus === "ordered") {
        const { rows: prItems } = await client.query<Record<string, unknown>>(
          `SELECT * FROM app.purchase_requisition_items WHERE pr_id = $1 ORDER BY created_at`,
          [id],
        );
        const totalAmount = prItems.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.estimated_unit_cost) || 0),
          0,
        );
        // LPO number: strip leading "PR" from the PR number and prefix with "LPO"
        const poNumber = `LPO-${(row.pr_number as string).replace(/^PR-?/i, "")}`;
        const { rows: poRows } = await client.query<{ id: string }>(
          `INSERT INTO app.purchase_orders
             (tenant_id, po_number, pr_id, title, status, total_amount)
           VALUES ($1, $2, $3, $4, 'draft', $5)
           RETURNING id`,
          [tenantId, poNumber, id, row.title, totalAmount],
        );
        const po = poRows[0];
        po_id = po.id;
        for (const item of prItems) {
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.estimated_unit_cost) || 0;
          await client.query(
            `INSERT INTO app.purchase_order_items
               (tenant_id, po_id, description, quantity, unit, unit_price, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId, po.id, item.description, qty, item.unit ?? "units", unitPrice, item.notes ?? null],
          );
        }
      }

      // Return the updated row, pre-transition status, and new PO id (if any)
      return { row, fromStatus: currentStatus, po_id };
    });

    if (result === null) return reply.status(404).send({ error: "Requisition not found" });
    if (result && "_invalid" in result) return reply.status(422).send({ error: result._invalid });
    if (result && "_forbidden" in result) return reply.status(403).send({ error: result._forbidden });

    const { row: updatedPR, fromStatus, po_id } = result as { row: Record<string, unknown>; fromStatus: string; po_id?: string };

    // Fire notifications after the main transaction has committed — fire-and-forget
    notifyPRTransition(
      tenantId,
      {
        id: updatedPR.id as string,
        pr_number: updatedPR.pr_number as string,
        title: updatedPR.title as string,
        requested_by: (updatedPR.requested_by as string | undefined) ?? null,
      },
      fromStatus,
      updatedPR.status as string,
    ).catch((err: unknown) => {
      console.error("[notify] PR transition notification failed:", err);
    });

    // Include po_id in response so the frontend can redirect straight to the new LPO
    return reply.send(po_id ? { ...updatedPR, po_id } : updatedPR);
  });

  // ==========================================================================
  // PURCHASE REQUISITION ITEMS (add / delete — draft only)
  // ==========================================================================

  app.post("/procurement/requisitions/:id/items", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = PRItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const row = await withTenant(tenantId, async (client) => {
      const { rows: prs } = await client.query<{ status: string }>(
        `SELECT status FROM app.purchase_requisitions WHERE id = $1`, [id],
      );
      if (!prs[0]) return { _notFound: true } as const;
      if (prs[0].status !== "draft") return { _locked: true } as const;

      const { rows } = await client.query(
        `INSERT INTO app.purchase_requisition_items
           (tenant_id, pr_id, description, vote_item, quantity, unit, estimated_unit_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${PR_ITEM_COLS}`,
        [tenantId, id, d.description, d.vote_item ?? null, d.quantity, d.unit, d.estimated_unit_cost ?? null, d.notes ?? null],
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Requisition not found" });
    if ("_notFound" in row) return reply.status(404).send({ error: "Requisition not found" });
    if ("_locked" in row) return reply.status(409).send({ error: "Items can only be added to a draft requisition" });

    return reply.status(201).send(row);
  });

  app.delete("/procurement/requisitions/:id/items/:itemId", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id, itemId } = req.params as { id: string; itemId: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: prs } = await client.query<{ status: string }>(
        `SELECT status FROM app.purchase_requisitions WHERE id = $1`, [id],
      );
      if (!prs[0]) return { _notFound: true } as const;
      if (prs[0].status !== "draft") return { _locked: true } as const;

      // Ensure at least one item will remain
      const { rows: countRows } = await client.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM app.purchase_requisition_items WHERE pr_id = $1`, [id],
      );
      if (Number(countRows[0]?.cnt ?? 0) <= 1) return { _lastItem: true } as const;

      const { rowCount } = await client.query(
        `DELETE FROM app.purchase_requisition_items WHERE id = $1 AND pr_id = $2`, [itemId, id],
      );
      return { deleted: (rowCount ?? 0) > 0 };
    });

    if (!result) return reply.status(404).send({ error: "Requisition not found" });
    if ("_notFound" in result) return reply.status(404).send({ error: "Requisition not found" });
    if ("_locked" in result) return reply.status(409).send({ error: "Items can only be removed from a draft requisition" });
    if ("_lastItem" in result) return reply.status(409).send({ error: "A requisition must have at least one item" });
    if (!result.deleted) return reply.status(404).send({ error: "Item not found" });

    return reply.status(204).send();
  });

  // ==========================================================================
  // PURCHASE ORDERS
  // ==========================================================================

  app.get("/procurement/orders", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = POQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, status, supplier_id, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (status) { params.push(status); conds.push(`po.status = $${params.length}`); }
      if (supplier_id) { params.push(supplier_id); conds.push(`po.supplier_id = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(po.title ILIKE $${params.length} OR po.po_number ILIKE $${params.length})`);
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT po.id, po.po_number, po.pr_id, po.supplier_id, po.title, po.status,
                po.order_date, po.expected_delivery_date, po.total_amount, po.notes,
                po.created_at, po.updated_at,
                s.name AS supplier_name
         FROM app.purchase_orders po
         LEFT JOIN app.suppliers s ON po.supplier_id = s.id
         ${where}
         ORDER BY po.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/procurement/orders", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreatePOSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const totalAmount = d.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.purchase_orders
           (tenant_id, po_number, pr_id, supplier_id, title, order_date, expected_delivery_date, total_amount, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${PO_COLS}`,
        [tenantId, d.po_number, d.pr_id ?? null, d.supplier_id ?? null, d.title,
         d.order_date ?? null, d.expected_delivery_date ?? null, totalAmount, d.notes ?? null],
      );
      const po = rows[0];

      for (const item of d.items) {
        await client.query(
          `INSERT INTO app.purchase_order_items
             (tenant_id, po_id, description, quantity, unit, unit_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tenantId, po.id, item.description, item.quantity, item.unit, item.unit_price, item.notes ?? null],
        );
      }

      return po;
    });

    return reply.status(201).send(result);
  });

  app.get("/procurement/orders/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: pos } = await client.query(
        `SELECT po.*, s.name AS supplier_name
         FROM app.purchase_orders po
         LEFT JOIN app.suppliers s ON po.supplier_id = s.id
         WHERE po.id = $1`, [id],
      );
      if (!pos[0]) return null;
      const { rows: items } = await client.query(
        `SELECT ${PO_ITEM_COLS} FROM app.purchase_order_items WHERE po_id = $1 ORDER BY created_at`, [id],
      );
      return { ...pos[0], items };
    });

    if (!result) return reply.status(404).send({ error: "Purchase order not found" });
    return reply.send(result);
  });

  app.patch("/procurement/orders/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdatePOSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("supplier_id", d.supplier_id);
    addField("title", d.title);
    addField("order_date", d.order_date);
    addField("expected_delivery_date", d.expected_delivery_date);
    addField("notes", d.notes);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.purchase_orders SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${PO_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Purchase order not found" });
    return reply.send(row);
  });

  app.post("/procurement/orders/:id/transition", { preHandler: requireRole(...ADMIN_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = TransitionPOSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.purchase_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING ${PO_COLS}`,
        [parsed.data.status, id],
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "Purchase order not found" });
    return reply.send(row);
  });

  // ==========================================================================
  // GOODS RECEIVED NOTES
  // ==========================================================================

  app.get("/procurement/grns", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = GRNQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const { search, status, po_id, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      const conds: string[] = [];
      const params: unknown[] = [];

      if (status) { params.push(status); conds.push(`status = $${params.length}`); }
      if (po_id) { params.push(po_id); conds.push(`po_id = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(grn_number ILIKE $${params.length} OR received_by ILIKE $${params.length})`);
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(limit, offset);
      return client.query(
        `SELECT ${GRN_COLS} FROM app.goods_received_notes ${where} ORDER BY received_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
    });

    return reply.send(rows.rows);
  });

  app.post("/procurement/grns", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = CreateGRNSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app.goods_received_notes (tenant_id, grn_number, po_id, received_by, received_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${GRN_COLS}`,
        [tenantId, d.grn_number, d.po_id ?? null, d.received_by ?? null, d.received_date ?? null, d.notes ?? null],
      );
      const grn = rows[0];

      for (const item of d.items) {
        await client.query(
          `INSERT INTO app.grn_items (tenant_id, grn_id, po_item_id, description, quantity_ordered, quantity_received, condition, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tenantId, grn.id, item.po_item_id ?? null, item.description, item.quantity_ordered ?? null, item.quantity_received, item.condition, item.notes ?? null],
        );
      }

      return grn;
    });

    return reply.status(201).send(result);
  });

  app.get("/procurement/grns/:id", { preHandler: requireRole(...READ_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tenantId, async (client) => {
      const { rows: grns } = await client.query(
        `SELECT ${GRN_COLS} FROM app.goods_received_notes WHERE id = $1`, [id],
      );
      if (!grns[0]) return null;
      const { rows: items } = await client.query(
        `SELECT ${GRN_ITEM_COLS} FROM app.grn_items WHERE grn_id = $1 ORDER BY created_at`, [id],
      );
      return { ...grns[0], items };
    });

    if (!result) return reply.status(404).send({ error: "GRN not found" });
    return reply.send(result);
  });

  app.patch("/procurement/grns/:id", { preHandler: requireRole(...WRITE_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const parsed = UpdateGRNSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    };
    addField("received_by", d.received_by);
    addField("received_date", d.received_date);
    addField("notes", d.notes);

    if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

    params.push(id);
    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.goods_received_notes SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${GRN_COLS}`,
        params,
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "GRN not found" });
    return reply.send(row);
  });

  app.post("/procurement/grns/:id/confirm", { preHandler: requireRole(...ADMIN_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header required" });

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.goods_received_notes SET status = 'confirmed', updated_at = now() WHERE id = $1 AND status = 'draft' RETURNING ${GRN_COLS}`,
        [id],
      );
      return rows[0];
    });

    if (!row) return reply.status(404).send({ error: "GRN not found or already confirmed" });

    // fire-and-forget notification
    notifyGRNConfirmed(tenantId, { id: row.id, grn_number: row.grn_number, po_id: row.po_id }).catch(console.error);

    return reply.send(row);
  });
}
