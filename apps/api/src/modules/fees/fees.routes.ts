import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  FeeEntrySchema,
  FeeImportSchema,
  FeeTransactionsQuerySchema,
  SchoolPayWebhookSchema,
  ReconciliationQuerySchema,
  ReconciliationMatchSchema,
} from "./fees.schema.js";
import { pool } from "../../db/pool.js";

// ------------------------------------------------------------------ constants

const SUMMARY_ROLES = [
  "registrar",
  "hod",
  "admin",
  "finance",
  "principal",
  "dean",
] as const;
const TXN_ROLES = ["registrar", "finance", "admin"] as const;
const FINANCE_ROLES = ["finance", "admin"] as const;

// ------------------------------------------------------------------ routes

export async function feesRoutes(app: FastifyInstance) {
  // ---------- GET /fees/students/:studentId/summary
  app.get<{ Params: { studentId: string } }>(
    "/fees/students/:studentId/summary",
    { preHandler: requireRole(...SUMMARY_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId } = req.params;

      const result = await withTenant(tid, async (client) => {
        // Get defaultTotalDue from published config
        const { rows: cfgRows } = await client.query<{
          payload: { fees?: { defaultTotalDue?: number } };
        }>(
          `SELECT payload FROM platform.config_versions
           WHERE tenant_id = $1 AND status = 'published'
           LIMIT 1`,
          [tid],
        );
        const defaultTotalDue: number =
          cfgRows[0]?.payload?.fees?.defaultTotalDue ?? 0;

        const { rows } = await client.query<{
          total_paid: string;
          last_payment: string | null;
        }>(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid, MAX(paid_at) AS last_payment
           FROM app.payments
           WHERE student_id = $1`,
          [studentId],
        );

        const totalPaid = Number(rows[0].total_paid);
        const balance = defaultTotalDue - totalPaid;
        const badge =
          balance <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "OWING";

        return {
          totalPaid,
          totalDue: defaultTotalDue,
          balance,
          lastPayment: rows[0].last_payment ?? null,
          badge,
        };
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- GET /fees/students/:studentId/transactions
  app.get<{ Params: { studentId: string } }>(
    "/fees/students/:studentId/transactions",
    { preHandler: requireRole(...TXN_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId } = req.params;
      const qParsed = FeeTransactionsQuerySchema.safeParse(req.query);
      const { page, limit } = qParsed.success
        ? qParsed.data
        : { page: 1, limit: 20 };
      const offset = (page - 1) * limit;

      const result = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM app.payments
           WHERE student_id = $1
           ORDER BY paid_at DESC
           LIMIT $2 OFFSET $3`,
          [studentId, limit, offset],
        );
        return { rows };
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- POST /fees/entry
  app.post(
    "/fees/entry",
    { preHandler: requireRole(...FINANCE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = FeeEntrySchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, amount, currency, reference, paid_at } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        const { rows: payRows } = await client.query(
          `INSERT INTO app.payments
             (tenant_id, student_id, amount, currency, reference, paid_at, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'manual')
           RETURNING *`,
          [tid, student_id, amount, currency, reference, paid_at],
        );
        const payment = payRows[0];

        // Audit log — writes only, not GET requests
        await client.query(
          `INSERT INTO app.fee_audit_log
             (tenant_id, payment_id, action, actor_user_id)
           VALUES ($1, $2, 'manual_entry', $3)`,
          [tid, payment.id, actorUserId],
        );

        return { payment };
      });

      return reply.status(201).send(result);
    },
  );

  // ---------- POST /fees/import
  app.post(
    "/fees/import",
    { preHandler: requireRole(...FINANCE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = FeeImportSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        let inserted = 0;
        const errors: Array<{ row: number; message: string }> = [];

        for (let i = 0; i < parsed.data.rows.length; i++) {
          const row = parsed.data.rows[i];
          try {
            const { rows: payRows } = await client.query(
              `INSERT INTO app.payments
                 (tenant_id, student_id, amount, currency, reference, paid_at, source, imported_by)
               VALUES ($1, $2, $3, 'ZAR', $4, $5, 'import', $6)
               RETURNING id`,
              [
                tid,
                row.studentId,
                row.amount,
                row.reference,
                row.paid_at,
                actorUserId,
              ],
            );

            // Audit log — imports only, not reads
            await client.query(
              `INSERT INTO app.fee_audit_log
                 (tenant_id, payment_id, action, actor_user_id)
               VALUES ($1, $2, 'import', $3)`,
              [tid, payRows[0].id, actorUserId],
            );

            inserted++;
          } catch (err) {
            errors.push({ row: i + 1, message: String(err) });
          }
        }

        return { inserted, errors };
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- POST /webhooks/schoolpay — SchoolPay integration (SR-F-014)
  // No auth — webhook from external SchoolPay system
  app.post("/webhooks/schoolpay", async (req, reply) => {
    const parsed = SchoolPayWebhookSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.status(422).send({ error: "validation failed", issues: parsed.error.issues });

    const d = parsed.data;

    // Resolve tenant slug → ID (no auth context for webhooks)
    const { rows: tRows } = await pool.query<{ id: string }>(
      `SELECT id FROM platform.tenants WHERE slug = $1 AND is_active = true`,
      [d.tenant_slug],
    );
    if (tRows.length === 0)
      return reply.status(404).send({ error: "tenant not found" });

    const tenantId = tRows[0].id;

    const result = await withTenant(tenantId, async (client) => {
      // Idempotency: skip if reference already exists for this tenant
      const { rows: existing } = await client.query(
        `SELECT id FROM app.schoolpay_transactions WHERE schoolpay_ref = $1`,
        [d.reference],
      );
      if (existing.length > 0) return { duplicate: true, id: existing[0].id };

      const { rows } = await client.query(
        `INSERT INTO app.schoolpay_transactions
           (tenant_id, schoolpay_ref, student_name, amount, currency, paid_at, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, status`,
        [
          tenantId,
          d.reference,
          d.student_name ?? null,
          d.amount,
          d.currency,
          d.paid_at,
          JSON.stringify(d.payload ?? {}),
        ],
      );
      return rows[0];
    });

    if ("duplicate" in result)
      return reply.status(200).send({ message: "already processed", id: result.id });

    return reply.status(201).send({ transaction: result });
  });

  // ---------- GET /fees/reconciliation
  app.get(
    "/fees/reconciliation",
    { preHandler: requireRole(...FINANCE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const qParsed = ReconciliationQuerySchema.safeParse(req.query);
      const { status, page, limit } = qParsed.success
        ? qParsed.data
        : { status: undefined, page: 1, limit: 20 };
      const offset = (page - 1) * limit;

      const result = await withTenant(tid, async (client) => {
        const conditions = ["1=1"];
        const params: unknown[] = [limit, offset];
        if (status) {
          conditions.push(`status = $${params.length + 1}`);
          params.push(status);
        }

        const { rows } = await client.query(
          `SELECT * FROM app.schoolpay_transactions
           WHERE ${conditions.join(" AND ")}
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          params,
        );
        return rows;
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- POST /fees/reconciliation/:id/match
  app.post<{ Params: { id: string } }>(
    "/fees/reconciliation/:id/match",
    { preHandler: requireRole(...FINANCE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ReconciliationMatchSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const { student_id } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        // Verify transaction exists and is unmatched
        const { rows: txnRows } = await client.query(
          `SELECT id, amount, currency FROM app.schoolpay_transactions WHERE id = $1`,
          [id],
        );
        if (txnRows.length === 0) return { notFound: true } as const;

        const txn = txnRows[0];

        // Create a payment record linked to the student
        const { rows: payRows } = await client.query(
          `INSERT INTO app.payments
             (tenant_id, student_id, amount, currency, reference, paid_at, source)
           VALUES ($1, $2, $3, $4, $5, now(), 'schoolpay')
           RETURNING id`,
          [tid, student_id, txn.amount, txn.currency, `schoolpay:${txn.id}`],
        );

        // Mark the SchoolPay transaction as matched
        await client.query(
          `UPDATE app.schoolpay_transactions
           SET status = 'matched', student_id_match = $1, payment_id_match = $2,
               matched_at = now(), matched_by = $3
           WHERE id = $4`,
          [student_id, payRows[0].id, actorUserId, id],
        );

        // Audit log
        await client.query(
          `INSERT INTO app.fee_audit_log
             (tenant_id, payment_id, action, actor_user_id)
           VALUES ($1, $2, 'schoolpay_match', $3)`,
          [tid, payRows[0].id, actorUserId],
        );

        return { matched: true, payment_id: payRows[0].id };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "transaction not found" });

      return reply.status(200).send(result);
    },
  );
}

