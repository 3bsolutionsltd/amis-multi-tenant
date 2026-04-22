import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { z } from "zod";

const TermAnalyticsQuerySchema = z.object({
  academic_year: z.string().optional(),
  term: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export async function analyticsRoutes(app: FastifyInstance) {
  // ---------- GET /analytics/term  (SR-F-027)
  app.get(
    "/analytics/term",
    { preHandler: requireRole("admin", "registrar", "hod", "principal") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = TermAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year, term, from, to } = parsed.data;

      const result = await withTenant(tid, async (client) => {
        // 1. Total active students
        const { rows: studentRows } = await client.query(
          `SELECT COUNT(*) AS total_students FROM app.students
           WHERE tenant_id = $1 AND is_active = true`,
          [tid],
        );

        // 2. Term registrations (optionally filtered)
        const trConditions: string[] = ["tr.tenant_id = $1"];
        const trParams: unknown[] = [tid];
        if (academic_year) {
          trParams.push(academic_year);
          trConditions.push(`tr.academic_year = $${trParams.length}`);
        }
        if (term) {
          trParams.push(term);
          trConditions.push(`tr.term = $${trParams.length}`);
        }
        const { rows: trRows } = await client.query(
          `SELECT COUNT(*) AS term_registrations
           FROM app.term_registrations tr
           WHERE ${trConditions.join(" AND ")}`,
          trParams,
        );

        // 3. Admissions by state
        const { rows: admissionRows } = await client.query(
          `SELECT wi.current_state, COUNT(*) AS count
           FROM app.admission_applications aa
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'admissions' AND wi.entity_id = aa.id
           WHERE aa.tenant_id = $1
           GROUP BY wi.current_state
           ORDER BY count DESC`,
          [tid],
        );

        // 4. Marks submissions by state
        const { rows: marksRows } = await client.query(
          `SELECT wi.current_state, COUNT(*) AS count
           FROM app.mark_submissions ms
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'marks' AND wi.entity_id = ms.id
           WHERE ms.tenant_id = $1
           GROUP BY wi.current_state
           ORDER BY count DESC`,
          [tid],
        );

        // 5. Students by programme (top 10)
        const { rows: progRows } = await client.query(
          `SELECT p.code, p.title, COUNT(s.id) AS student_count
           FROM app.programmes p
           LEFT JOIN app.students s
             ON s.programme_id = p.id AND s.is_active = true
           WHERE p.tenant_id = $1
           GROUP BY p.id, p.code, p.title
           ORDER BY student_count DESC
           LIMIT 10`,
          [tid],
        );

        // 6. Industrial training by status
        const { rows: itRows } = await client.query(
          `SELECT status, COUNT(*) AS count
           FROM app.industrial_training
           WHERE tenant_id = $1
           GROUP BY status`,
          [tid],
        );

        // 7. Field placements by status
        const { rows: fpRows } = await client.query(
          `SELECT status, COUNT(*) AS count
           FROM app.field_placements
           WHERE tenant_id = $1
           GROUP BY status`,
          [tid],
        );

        // 8. Fees summary (SR-F-007 — management financial summary, with optional date-range)
        const feeConditions: string[] = ["p.tenant_id = $1"];
        const feeParams: unknown[] = [tid];
        if (from) {
          feeParams.push(from);
          feeConditions.push(`p.paid_at >= $${feeParams.length}::date`);
        }
        if (to) {
          feeParams.push(to);
          feeConditions.push(`p.paid_at <= ($${feeParams.length}::date + interval '1 day')`);
        }
        const feeWhere = feeConditions.join(" AND ");

        const { rows: feeRows } = await client.query(
          `SELECT
             COALESCE(SUM(amount_paid), 0)   AS total_collected,
             COUNT(DISTINCT student_id)       AS students_with_payments
           FROM (
             SELECT
               p.student_id,
               COALESCE(SUM(p.amount), 0) AS amount_paid
             FROM app.payments p
             WHERE ${feeWhere}
             GROUP BY p.student_id
           ) sub`,
          feeParams,
        );

        // 9. Payment trends — monthly totals (last 12 months or within date range)
        const trendConditions: string[] = ["tenant_id = $1"];
        const trendParams: unknown[] = [tid];
        if (from) {
          trendParams.push(from);
          trendConditions.push(`paid_at >= $${trendParams.length}::date`);
        }
        if (to) {
          trendParams.push(to);
          trendConditions.push(`paid_at <= ($${trendParams.length}::date + interval '1 day')`);
        }
        if (!from && !to) {
          trendConditions.push(`paid_at >= now() - interval '12 months'`);
        }
        const trendWhere = trendConditions.join(" AND ");

        const { rows: trendRows } = await client.query(
          `SELECT
             to_char(paid_at, 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0) AS total,
             COUNT(*) AS transaction_count
           FROM app.payments
           WHERE ${trendWhere}
           GROUP BY month
           ORDER BY month`,
          trendParams,
        );

        return {
          students: {
            total_active: Number(studentRows[0]?.total_students ?? 0),
          },
          term_registrations: {
            total: Number(trRows[0]?.term_registrations ?? 0),
            filters: { academic_year, term },
          },
          admissions_by_state: admissionRows.map((r) => ({
            state: r.current_state ?? "unknown",
            count: Number(r.count),
          })),
          marks_by_state: marksRows.map((r) => ({
            state: r.current_state ?? "unknown",
            count: Number(r.count),
          })),
          students_by_programme: progRows.map((r) => ({
            code: r.code,
            title: r.title,
            student_count: Number(r.student_count),
          })),
          industrial_training_by_status: itRows.map((r) => ({
            status: r.status,
            count: Number(r.count),
          })),
          field_placements_by_status: fpRows.map((r) => ({
            status: r.status,
            count: Number(r.count),
          })),
          fees_summary: {
            total_collected:          Number(feeRows[0]?.total_collected ?? 0),
            students_with_payments:   Number(feeRows[0]?.students_with_payments ?? 0),
            filters: { from: from ?? null, to: to ?? null },
          },
          payment_trends: trendRows.map((r) => ({
            month: r.month,
            total: Number(r.total),
            transaction_count: Number(r.transaction_count),
          })),
        };
      });

      return result;
    },
  );
}

