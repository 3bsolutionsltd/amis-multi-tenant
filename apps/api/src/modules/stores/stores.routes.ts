import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  SRQ_COLS,
  SRQ_ITEM_COLS,
  PCV_COLS,
  PCV_ITEM_COLS,
  CreateSRQSchema,
  UpdateSRQSchema,
  TransitionSRQSchema,
  SRQQuerySchema,
  CreatePCVSchema,
  UpdatePCVSchema,
  TransitionPCVSchema,
  PCVQuerySchema,
} from "./stores.schema.js";

const READ_ROLES = [
  "admin",
  "registrar",
  "finance",
  "principal",
  "hod",
  "dean",
  "procurement_officer",
  "inventory_manager",
  "instructor",
] as const;

const WRITE_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "inventory_manager",
  "procurement_officer",
] as const;

const HOD_ROLES = ["admin", "hod", "principal"] as const;
const FINANCE_ROLES = ["admin", "finance", "principal"] as const;
const STORE_ROLES = ["admin", "inventory_manager", "procurement_officer"] as const;

export async function storesRoutes(app: FastifyInstance) {
  // ==========================================================================
  // STORE REQUISITIONS (SRQ)
  // ==========================================================================

  // GET /stores/requisitions
  app.get(
    "/stores/requisitions",
    { preHandler: requireRole(...READ_ROLES) },
    async (req) => {
      const q = SRQQuerySchema.parse(req.query);
      const offset = (q.page - 1) * q.limit;
      return withTenant(req, async (db) => {
        const conditions: string[] = ["s.tenant_id = app.current_tenant_id()"];
        const params: unknown[] = [];
        let idx = 1;

        if (q.status) {
          conditions.push(`s.status = $${idx++}`);
          params.push(q.status);
        }
        if (q.department) {
          conditions.push(`s.department = $${idx++}`);
          params.push(q.department);
        }
        if (q.student_project_id) {
          conditions.push(`s.student_project_id = $${idx++}`);
          params.push(q.student_project_id);
        }
        if (q.search) {
          conditions.push(
            `(s.srq_number ILIKE $${idx} OR s.requested_by ILIKE $${idx} OR s.purpose ILIKE $${idx})`
          );
          params.push(`%${q.search}%`);
          idx++;
        }

        const where = conditions.join(" AND ");
        const rows = await db.query(
          `SELECT ${SRQ_COLS.replace(/\b(\w)/g, "s.$1")}
           FROM app.store_requisitions s
           WHERE ${where}
           ORDER BY s.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          [...params, q.limit, offset]
        );
        return rows.rows;
      });
    }
  );

  // GET /stores/requisitions/:id
  app.get(
    "/stores/requisitions/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      return withTenant(req, async (db) => {
        const srq = await db.query(
          `SELECT ${SRQ_COLS}
           FROM app.store_requisitions
           WHERE id = $1 AND tenant_id = app.current_tenant_id()`,
          [id]
        );
        if (!srq.rows[0]) throw { statusCode: 404, message: "SRQ not found" };

        const items = await db.query(
          `SELECT ${SRQ_ITEM_COLS}, inv.name AS item_name, inv.unit_of_measure,
                  inv.current_stock
           FROM app.store_requisition_items sri
           LEFT JOIN app.inventory_items inv ON inv.id = sri.item_id
           WHERE sri.srq_id = $1
           ORDER BY sri.created_at`,
          [id]
        );

        // linked GINs
        const gins = await db.query(
          `SELECT id, issuance_number, status, issue_date, issued_to
           FROM app.store_issuances
           WHERE srq_id = $1 AND tenant_id = app.current_tenant_id()
           ORDER BY created_at`,
          [id]
        );

        return { ...srq.rows[0], items: items.rows, gins: gins.rows };
      });
    }
  );

  // POST /stores/requisitions
  app.post(
    "/stores/requisitions",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const body = CreateSRQSchema.parse(req.body);
      return withTenant(req, async (db) => {
        const { rows } = await db.query(
          `INSERT INTO app.store_requisitions
             (tenant_id, srq_number, requested_by, department, purpose,
              required_date, student_project_id, course_id, term_id, notes)
           VALUES (app.current_tenant_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING ${SRQ_COLS}`,
          [
            body.srq_number,
            body.requested_by,
            body.department ?? null,
            body.purpose ?? null,
            body.required_date ?? null,
            body.student_project_id ?? null,
            body.course_id ?? null,
            body.term_id ?? null,
            body.notes ?? null,
          ]
        );
        const srq = rows[0];

        // Insert items
        for (const item of body.items) {
          await db.query(
            `INSERT INTO app.store_requisition_items
               (tenant_id, srq_id, item_id, description, quantity_requested, unit, unit_cost, notes)
             VALUES (app.current_tenant_id(), $1,$2,$3,$4,$5,$6,$7)`,
            [
              srq.id,
              item.item_id ?? null,
              item.description,
              item.quantity_requested,
              item.unit,
              item.unit_cost ?? null,
              item.notes ?? null,
            ]
          );
        }

        reply.code(201);
        return srq;
      });
    }
  );

  // PATCH /stores/requisitions/:id
  app.patch(
    "/stores/requisitions/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = UpdateSRQSchema.parse(req.body);
      return withTenant(req, async (db) => {
        const sets: string[] = ["updated_at = now()"];
        const params: unknown[] = [];
        let idx = 1;

        const fields: (keyof typeof body)[] = [
          "requested_by","department","purpose","required_date",
          "student_project_id","course_id","term_id","notes",
        ];
        for (const f of fields) {
          if (body[f] !== undefined) {
            sets.push(`${f} = $${idx++}`);
            params.push(body[f] ?? null);
          }
        }

        const { rows } = await db.query(
          `UPDATE app.store_requisitions
           SET ${sets.join(", ")}
           WHERE id = $${idx++} AND tenant_id = app.current_tenant_id()
             AND status = 'draft'
           RETURNING ${SRQ_COLS}`,
          [...params, id]
        );
        if (!rows[0]) throw { statusCode: 404, message: "SRQ not found or not editable" };
        return rows[0];
      });
    }
  );

  // POST /stores/requisitions/:id/transition
  app.post(
    "/stores/requisitions/:id/transition",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = TransitionSRQSchema.parse(req.body);
      return withTenant(req, async (db) => {
        // Load current SRQ
        const cur = await db.query(
          `SELECT status FROM app.store_requisitions
           WHERE id = $1 AND tenant_id = app.current_tenant_id()`,
          [id]
        );
        if (!cur.rows[0]) throw { statusCode: 404, message: "SRQ not found" };
        const { status } = cur.rows[0];

        const transitions: Record<string, string> = {
          submit: "submitted",
          hod_approve: "hod_approved",
          reject: "rejected",
          escalate_to_pr: "escalated_to_pr",
          fulfill: "fulfilled",
        };

        const allowed: Record<string, string[]> = {
          submit: ["draft"],
          hod_approve: ["submitted"],
          reject: ["submitted", "hod_approved"],
          escalate_to_pr: ["hod_approved"],
          fulfill: ["hod_approved"],
        };

        if (!allowed[body.action]?.includes(status)) {
          throw {
            statusCode: 400,
            message: `Cannot '${body.action}' an SRQ with status '${status}'`,
          };
        }

        const sets: string[] = [`status = '${transitions[body.action]}'`, "updated_at = now()"];
        const params: unknown[] = [];
        let idx = 1;

        if (body.action === "hod_approve") {
          sets.push(`hod_approved_by = $${idx++}`, `hod_approved_at = now()`);
          params.push(body.hod_approved_by ?? "");

          // Apply item approvals if provided
          if (body.item_approvals?.length) {
            for (const ia of body.item_approvals) {
              await db.query(
                `UPDATE app.store_requisition_items
                 SET quantity_approved = $1, unit_cost = COALESCE($2, unit_cost)
                 WHERE id = $3 AND srq_id = $4`,
                [ia.quantity_approved, ia.unit_cost ?? null, ia.id, id]
              );
            }
          }
        }

        if (body.action === "reject") {
          sets.push(`rejection_reason = $${idx++}`);
          params.push(body.rejection_reason ?? "");
        }

        const { rows } = await db.query(
          `UPDATE app.store_requisitions
           SET ${sets.join(", ")}
           WHERE id = $${idx++} AND tenant_id = app.current_tenant_id()
           RETURNING ${SRQ_COLS}`,
          [...params, id]
        );
        return rows[0];
      });
    }
  );

  // ==========================================================================
  // PETTY CASH VOUCHERS (PCV)
  // ==========================================================================

  // GET /stores/pcv
  app.get(
    "/stores/pcv",
    { preHandler: requireRole(...READ_ROLES) },
    async (req) => {
      const q = PCVQuerySchema.parse(req.query);
      const offset = (q.page - 1) * q.limit;
      return withTenant(req, async (db) => {
        const conditions: string[] = ["p.tenant_id = app.current_tenant_id()"];
        const params: unknown[] = [];
        let idx = 1;

        if (q.status) {
          conditions.push(`p.status = $${idx++}`);
          params.push(q.status);
        }
        if (q.department) {
          conditions.push(`p.department = $${idx++}`);
          params.push(q.department);
        }
        if (q.search) {
          conditions.push(
            `(p.pcv_number ILIKE $${idx} OR p.requested_by ILIKE $${idx} OR p.purpose ILIKE $${idx})`
          );
          params.push(`%${q.search}%`);
          idx++;
        }

        const where = conditions.join(" AND ");
        const rows = await db.query(
          `SELECT ${PCV_COLS.replace(/\b(\w)/g, "p.$1")}
           FROM app.petty_cash_vouchers p
           WHERE ${where}
           ORDER BY p.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          [...params, q.limit, offset]
        );
        return rows.rows;
      });
    }
  );

  // GET /stores/pcv/:id
  app.get(
    "/stores/pcv/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      return withTenant(req, async (db) => {
        const pcv = await db.query(
          `SELECT ${PCV_COLS}
           FROM app.petty_cash_vouchers
           WHERE id = $1 AND tenant_id = app.current_tenant_id()`,
          [id]
        );
        if (!pcv.rows[0]) throw { statusCode: 404, message: "PCV not found" };

        const items = await db.query(
          `SELECT ${PCV_ITEM_COLS}
           FROM app.petty_cash_voucher_items
           WHERE pcv_id = $1
           ORDER BY created_at`,
          [id]
        );
        return { ...pcv.rows[0], items: items.rows };
      });
    }
  );

  // POST /stores/pcv
  app.post(
    "/stores/pcv",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const body = CreatePCVSchema.parse(req.body);
      return withTenant(req, async (db) => {
        const { rows } = await db.query(
          `INSERT INTO app.petty_cash_vouchers
             (tenant_id, pcv_number, requested_by, department, purpose, amount_requested, notes)
           VALUES (app.current_tenant_id(), $1,$2,$3,$4,$5,$6)
           RETURNING ${PCV_COLS}`,
          [
            body.pcv_number,
            body.requested_by,
            body.department ?? null,
            body.purpose,
            body.amount_requested,
            body.notes ?? null,
          ]
        );
        const pcv = rows[0];

        for (const item of body.items) {
          await db.query(
            `INSERT INTO app.petty_cash_voucher_items
               (tenant_id, pcv_id, description, quantity, unit, unit_cost, notes)
             VALUES (app.current_tenant_id(), $1,$2,$3,$4,$5,$6)`,
            [
              pcv.id,
              item.description,
              item.quantity,
              item.unit,
              item.unit_cost,
              item.notes ?? null,
            ]
          );
        }

        reply.code(201);
        return pcv;
      });
    }
  );

  // PATCH /stores/pcv/:id
  app.patch(
    "/stores/pcv/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = UpdatePCVSchema.parse(req.body);
      return withTenant(req, async (db) => {
        const sets: string[] = ["updated_at = now()"];
        const params: unknown[] = [];
        let idx = 1;

        const fields: (keyof typeof body)[] = [
          "requested_by","department","purpose","amount_requested","notes",
        ];
        for (const f of fields) {
          if (body[f] !== undefined) {
            sets.push(`${f} = $${idx++}`);
            params.push(body[f]);
          }
        }

        const { rows } = await db.query(
          `UPDATE app.petty_cash_vouchers
           SET ${sets.join(", ")}
           WHERE id = $${idx++} AND tenant_id = app.current_tenant_id()
             AND status = 'draft'
           RETURNING ${PCV_COLS}`,
          [...params, id]
        );
        if (!rows[0]) throw { statusCode: 404, message: "PCV not found or not editable" };
        return rows[0];
      });
    }
  );

  // POST /stores/pcv/:id/transition
  app.post(
    "/stores/pcv/:id/transition",
    { preHandler: requireRole(...READ_ROLES) },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = TransitionPCVSchema.parse(req.body);
      return withTenant(req, async (db) => {
        const cur = await db.query(
          `SELECT status FROM app.petty_cash_vouchers
           WHERE id = $1 AND tenant_id = app.current_tenant_id()`,
          [id]
        );
        if (!cur.rows[0]) throw { statusCode: 404, message: "PCV not found" };
        const { status } = cur.rows[0];

        const transitions: Record<string, string> = {
          submit: "submitted",
          hod_approve: "hod_approved",
          bursar_approve: "bursar_approved",
          pay: "paid",
          retire: "retired",
          reject: "rejected",
        };

        const allowed: Record<string, string[]> = {
          submit: ["draft"],
          hod_approve: ["submitted"],
          bursar_approve: ["hod_approved"],
          pay: ["bursar_approved"],
          retire: ["paid"],
          reject: ["submitted", "hod_approved", "bursar_approved"],
        };

        if (!allowed[body.action]?.includes(status)) {
          throw {
            statusCode: 400,
            message: `Cannot '${body.action}' a PCV with status '${status}'`,
          };
        }

        const sets: string[] = [`status = '${transitions[body.action]}'`, "updated_at = now()"];
        const params: unknown[] = [];
        let idx = 1;

        if (body.action === "hod_approve") {
          sets.push(`hod_approved_by = $${idx++}`, `hod_approved_at = now()`);
          params.push(body.hod_approved_by ?? "");
          if (body.amount_approved !== undefined) {
            sets.push(`amount_approved = $${idx++}`);
            params.push(body.amount_approved);
          }
        }
        if (body.action === "bursar_approve") {
          sets.push(`bursar_approved_by = $${idx++}`, `bursar_approved_at = now()`);
          params.push(body.bursar_approved_by ?? "");
          if (body.amount_approved !== undefined) {
            sets.push(`amount_approved = $${idx++}`);
            params.push(body.amount_approved);
          }
        }
        if (body.action === "pay") {
          if (body.paid_by) { sets.push(`paid_by = $${idx++}`); params.push(body.paid_by); }
          sets.push(`paid_at = now()`);
          if (body.amount_paid !== undefined) {
            sets.push(`amount_paid = $${idx++}`);
            params.push(body.amount_paid);
          }
          if (body.payment_method) {
            sets.push(`payment_method = $${idx++}`);
            params.push(body.payment_method);
          }
        }
        if (body.action === "retire") {
          if (body.receipt_ref) { sets.push(`receipt_ref = $${idx++}`); params.push(body.receipt_ref); }
          if (body.receipt_date) { sets.push(`receipt_date = $${idx++}`); params.push(body.receipt_date); }
          sets.push(`retired_at = now()`);
        }
        if (body.action === "reject") {
          sets.push(`rejection_reason = $${idx++}`);
          params.push(body.rejection_reason ?? "");
        }

        const { rows } = await db.query(
          `UPDATE app.petty_cash_vouchers
           SET ${sets.join(", ")}
           WHERE id = $${idx++} AND tenant_id = app.current_tenant_id()
           RETURNING ${PCV_COLS}`,
          [...params, id]
        );
        return rows[0];
      });
    }
  );
}
