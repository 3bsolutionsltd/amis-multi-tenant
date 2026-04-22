import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { sendSms, buildPaymentConfirmationSms } from "../../lib/sms.js";
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

        // Fetch student phone for SMS
        const { rows: stuRows } = await client.query<{ first_name: string; last_name: string; phone: string | null }>(
          `SELECT first_name, last_name, phone FROM app.students WHERE id = $1`,
          [student_id],
        );

        return { payment, student: stuRows[0] ?? null };
      });

      // Fire-and-forget SMS (don't fail the response on SMS error)
      if (result.student?.phone) {
        const msg = buildPaymentConfirmationSms({
          studentName: `${result.student.first_name} ${result.student.last_name}`,
          amount: result.payment.amount,
          currency: result.payment.currency ?? "UGX",
          reference: result.payment.reference ?? result.payment.id,
        });
        sendSms(result.student.phone, msg).catch((err) =>
          console.error("[SMS] Fee entry notification failed:", err),
        );
      }

      return reply.status(201).send({ payment: result.payment });
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

  // ---------- GET /fees/overview
  // Aggregated fee stats across all students for a tenant
  app.get(
    "/fees/overview",
    { preHandler: requireRole(...SUMMARY_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

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

        // Total students
        const { rows: countRows } = await client.query(
          `SELECT COUNT(*)::int AS total FROM app.students WHERE is_active = true`,
        );
        const totalStudents = countRows[0].total;

        // Total collected
        const { rows: sumRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_collected FROM app.payments`,
        );
        const totalCollected = Number(sumRows[0].total_collected);

        // Total expected
        const totalExpected = totalStudents * defaultTotalDue;

        // Collection rate
        const collectionRate =
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 10000) / 100
            : 0;

        // Students who have paid in full
        const { rows: paidRows } = await client.query(
          `SELECT COUNT(DISTINCT p.student_id)::int AS paid_count
           FROM app.payments p
           JOIN app.students s ON s.id = p.student_id AND s.is_active = true
           GROUP BY p.student_id
           HAVING SUM(p.amount) >= $1`,
          [defaultTotalDue],
        );
        const fullyPaid = paidRows.length;

        return {
          totalStudents,
          totalExpected,
          totalCollected,
          collectionRate,
          fullyPaid,
          defaulters: totalStudents - fullyPaid,
          defaultTotalDue,
        };
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- GET /fees/defaulters
  // Students with outstanding balances
  app.get(
    "/fees/defaulters",
    { preHandler: requireRole(...SUMMARY_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

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

        const { rows } = await client.query(
          `SELECT s.id, s.first_name, s.last_name, s.admission_number, s.programme,
                  COALESCE(p.total_paid, 0) AS total_paid,
                  ($1 - COALESCE(p.total_paid, 0)) AS balance
           FROM app.students s
           LEFT JOIN (
             SELECT student_id, SUM(amount) AS total_paid
             FROM app.payments
             GROUP BY student_id
           ) p ON p.student_id = s.id
           WHERE s.is_active = true
             AND COALESCE(p.total_paid, 0) < $1
           ORDER BY balance DESC`,
          [defaultTotalDue],
        );

        return rows;
      });

      return reply.status(200).send(result);
    },
  );

  // ---------- GET /fees/students/:studentId/clearance
  // Check if a student has met the fee clearance threshold
  app.get<{ Params: { studentId: string } }>(
    "/fees/students/:studentId/clearance",
    { preHandler: requireRole(...SUMMARY_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId } = req.params;

      const result = await withTenant(tid, async (client) => {
        // Get clearance threshold from published config (percentage 0-100)
        const { rows: cfgRows } = await client.query<{
          payload: { fees?: { clearanceThreshold?: number; defaultTotalDue?: number } };
        }>(
          `SELECT payload FROM platform.config_versions
           WHERE tenant_id = $1 AND status = 'published'
           LIMIT 1`,
          [tid],
        );
        const threshold: number =
          cfgRows[0]?.payload?.fees?.clearanceThreshold ?? 100;
        const totalDue: number =
          cfgRows[0]?.payload?.fees?.defaultTotalDue ?? 0;

        // Verify student exists
        const { rows: stuRows } = await client.query(
          `SELECT id, first_name, last_name, admission_number FROM app.students WHERE id = $1`,
          [studentId],
        );
        if (stuRows.length === 0) return { notFound: true } as const;

        // Sum payments
        const { rows: payRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM app.payments WHERE student_id = $1`,
          [studentId],
        );
        const totalPaid = Number(payRows[0].total_paid);
        const requiredAmount = (threshold / 100) * totalDue;
        const cleared = totalPaid >= requiredAmount;

        return {
          student: stuRows[0],
          totalDue,
          totalPaid,
          threshold,
          requiredAmount,
          cleared,
          balance: totalDue - totalPaid,
        };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });

      return reply.status(200).send(result);
    },
  );
}
