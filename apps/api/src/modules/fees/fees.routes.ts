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

type StudentFeeContext = {
  id: string;
  programme_id: string | null;
  programme: string | null;
  programme_code: string | null;
  sponsorship_type: string | null;
};

type FeeStructureLine = {
  id: string;
  fee_type: string;
  student_category: string;
  description: string | null;
  amount: string;
  currency: string;
  academic_year_name: string | null;
  term_name: string | null;
  programme_code: string | null;
  programme_title: string | null;
};

type Queryable = {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type FeeBalanceResult =
  | { notFound: true }
  | { totalDue: number; totalPaid: number; balance: number };

type PaymentRow = {
  id: string;
  amount: string | number;
  currency: string | null;
  reference: string | null;
  [key: string]: unknown;
};

type StudentSmsContact = {
  first_name: string;
  last_name: string;
  phone: string | null;
};

type ManualFeeEntryResult =
  | { notFound: true }
  | { overpayment: true; totalDue: number; totalPaid: number; balance: number }
  | { payment: PaymentRow; student: StudentSmsContact | null };

function studentCategory(sponsorshipType: string | null) {
  const normalized = sponsorshipType?.toLowerCase() ?? "";
  if (normalized.includes("boarding") || normalized.includes("boarder")) return "boarding";
  if (normalized.includes("day")) return "day";
  if (normalized.trim()) return "day";
  return "all";
}

async function getDefaultTotalDue(client: Queryable, tid: string) {
  const { rows: cfgRows } = await client.query<{
    payload: { fees?: { defaultTotalDue?: number } };
  }>(
    `SELECT payload FROM platform.config_versions
     WHERE tenant_id = $1 AND status = 'published'
     LIMIT 1`,
    [tid],
  );
  return cfgRows[0]?.payload?.fees?.defaultTotalDue ?? 0;
}

async function loadStudentFeeContext(client: Queryable, studentId: string) {
  const { rows } = await client.query<StudentFeeContext>(
    `SELECT id, programme_id, programme, programme_code, sponsorship_type
     FROM app.students
     WHERE id = $1`,
    [studentId],
  );
  return rows[0] ?? null;
}

async function listApplicableFeeStructures(
  client: Queryable,
  student: StudentFeeContext,
) {
  const category = studentCategory(student.sponsorship_type);
  const categoryFilter = category === "all" ? ["all"] : ["all", category];

  const { rows } = await client.query<FeeStructureLine>(
    `SELECT fs.id, fs.fee_type, fs.student_category, fs.description, fs.amount, fs.currency,
            ay.name AS academic_year_name,
            t.name AS term_name,
            p.code AS programme_code,
            p.title AS programme_title
     FROM app.fee_structures fs
     JOIN app.programmes p ON p.id = fs.programme_id
     JOIN app.academic_years ay ON ay.id = fs.academic_year_id
     LEFT JOIN app.terms t ON t.id = fs.term_id
     WHERE fs.is_active = true
       AND ay.is_current = true
       AND (fs.term_id IS NULL OR t.is_current = true)
       AND fs.student_category = ANY($1::text[])
       AND (
         fs.programme_id = $2::uuid
         OR lower(p.code) = lower(COALESCE($3, ''))
         OR lower(p.title) = lower(COALESCE($4, ''))
       )
     ORDER BY fs.term_id NULLS FIRST, fs.fee_type, fs.student_category`,
    [categoryFilter, student.programme_id, student.programme_code, student.programme],
  );

  return rows;
}

async function calculateStudentTotalDue(
  client: Queryable,
  tid: string,
  studentId: string,
) {
  const defaultTotalDue = await getDefaultTotalDue(client, tid);
  const student = await loadStudentFeeContext(client, studentId);
  if (!student) {
    return { notFound: true as const };
  }

  const feeStructures = await listApplicableFeeStructures(client, student);
  const structuredTotalDue = feeStructures.reduce(
    (sum, line) => sum + Number(line.amount),
    0,
  );
  const totalDue = structuredTotalDue > 0 ? structuredTotalDue : defaultTotalDue;

  return {
    student,
    feeStructures,
    totalDue,
    totalDueSource: structuredTotalDue > 0 ? "fee_structures" : "config_default",
    defaultTotalDue,
  };
}

async function calculateStudentFeeBalance(
  client: Queryable,
  tid: string,
  studentId: string,
): Promise<FeeBalanceResult> {
  const due = await calculateStudentTotalDue(client, tid, studentId);
  if ("notFound" in due) return { notFound: true as const };

  const { rows } = await client.query<{ total_paid: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM app.payments
     WHERE student_id = $1`,
    [studentId],
  );

  const totalPaid = Number(rows[0].total_paid);
  return {
    totalDue: due.totalDue,
    totalPaid,
    balance: due.totalDue - totalPaid,
  };
}

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
        const due = await calculateStudentTotalDue(client, tid, studentId);
        if ("notFound" in due) return due;

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
        const balance = due.totalDue - totalPaid;
        const badge =
          balance <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "OWING";

        return {
          totalPaid,
          totalDue: due.totalDue,
          balance,
          lastPayment: rows[0].last_payment ?? null,
          badge,
          totalDueSource: due.totalDueSource,
          defaultTotalDue: due.defaultTotalDue,
          feeStructures: due.feeStructures.map((line) => ({
            ...line,
            amount: Number(line.amount),
          })),
        };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });

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

      const { student_id, amount, currency, payment_method, reference, paid_at, academic_year_id, term_id } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client): Promise<ManualFeeEntryResult> => {
        const feeBalance = await calculateStudentFeeBalance(client, tid, student_id);
        if ("notFound" in feeBalance) return feeBalance;

        if (amount > Math.max(feeBalance.balance, 0)) {
          return {
            overpayment: true as const,
            totalDue: feeBalance.totalDue,
            totalPaid: feeBalance.totalPaid,
            balance: feeBalance.balance,
          };
        }

        const { rows: payRows } = await client.query<PaymentRow>(
          `INSERT INTO app.payments
             (tenant_id, student_id, amount, currency, payment_method, reference, paid_at, source, academic_year_id, term_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8, $9)
           RETURNING *`,
          [tid, student_id, amount, currency, payment_method ?? null, reference, paid_at,
           academic_year_id ?? null, term_id ?? null],
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
        const { rows: stuRows } = await client.query<StudentSmsContact>(
          `SELECT first_name, last_name, phone FROM app.students WHERE id = $1`,
          [student_id],
        );

        return { payment, student: stuRows[0] ?? null };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });

      if ("overpayment" in result)
        return reply.status(409).send({
          error: "Payment amount exceeds the outstanding balance",
          code: "PAYMENT_EXCEEDS_BALANCE",
          totalDue: result.totalDue,
          totalPaid: result.totalPaid,
          balance: result.balance,
        });

      // Fire-and-forget SMS (don't fail the response on SMS error)
      if (result.student?.phone) {
        const msg = buildPaymentConfirmationSms({
          studentName: `${result.student.first_name} ${result.student.last_name}`,
          amount: Number(result.payment.amount),
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

        // Total expected + fullyPaid: computed per-student from fee structures.
        // Each student's due is the sum of active fee structure lines that match
        // their programme and sponsorship category (same logic as the per-student
        // summary endpoint). Falls back to defaultTotalDue when no structures match.
        const { rows: dueRows } = await client.query<{
          total_expected: string;
          fully_paid: number;
        }>(
          `WITH student_cats AS (
             SELECT
               id,
               programme_id,
               programme_code,
               programme,
               CASE
                 WHEN LOWER(sponsorship_type) LIKE '%boarding%'
                   OR LOWER(sponsorship_type) LIKE '%boarder%' THEN 'boarding'
                 WHEN sponsorship_type IS NOT NULL AND TRIM(sponsorship_type) != '' THEN 'day'
                 ELSE 'all'
               END AS cat
             FROM app.students
             WHERE is_active = true
           ),
           student_due AS (
             SELECT
               sc.id,
               COALESCE(
                 (SELECT SUM(fs.amount)
                  FROM app.fee_structures fs
                  JOIN app.programmes p ON p.id = fs.programme_id
                  JOIN app.academic_years ay ON ay.id = fs.academic_year_id AND ay.is_current = true
                  LEFT JOIN app.terms t ON t.id = fs.term_id
                  WHERE fs.is_active = true
                    AND (fs.term_id IS NULL OR t.is_current = true)
                    AND fs.student_category = ANY(ARRAY['all', sc.cat])
                    AND (
                      fs.programme_id = sc.programme_id
                      OR LOWER(p.code) = LOWER(COALESCE(sc.programme_code, ''))
                      OR LOWER(p.title) = LOWER(COALESCE(sc.programme, ''))
                    )
                 ),
                 $1
               ) AS due,
               COALESCE(
                 (SELECT SUM(amount) FROM app.payments WHERE student_id = sc.id),
                 0
               ) AS paid
             FROM student_cats sc
           )
           SELECT
             COALESCE(SUM(due), 0)::numeric AS total_expected,
             COUNT(*) FILTER (WHERE paid >= due)::int AS fully_paid
           FROM student_due`,
          [defaultTotalDue],
        );
        const totalExpected = Number(dueRows[0]?.total_expected ?? 0);
        const fullyPaid = dueRows[0]?.fully_paid ?? 0;

        // Collection rate
        const collectionRate =
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 10000) / 100
            : 0;

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
