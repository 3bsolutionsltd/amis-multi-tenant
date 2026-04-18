import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  FeeEntrySchema,
  FeeImportSchema,
  FeeTransactionsQuerySchema,
} from "./fees.schema.js";

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

  // ---------- POST /webhooks/schoolpay — stub only
  app.post("/webhooks/schoolpay", async (_req, reply) => {
    return reply.status(501).send({ error: "Not Implemented" });
  });
}

