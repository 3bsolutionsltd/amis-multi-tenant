import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateITReportSchema,
  ITReportQuerySchema,
  CreateEvaluationSchema,
  EvaluationQuerySchema,
  CreateInstructorReportSchema,
  UpdateInstructorReportSchema,
  InstructorReportQuerySchema,
} from "./reports.schema.js";

const ALL_ROLES = [
  "admin",
  "registrar",
  "instructor",
  "finance",
  "hod",
  "principal",
  "dean",
] as const;

const MANAGEMENT_ROLES = [
  "admin",
  "registrar",
  "hod",
  "principal",
  "dean",
] as const;

const INSTRUCTOR_ROLES = [
  "admin",
  "registrar",
  "hod",
  "principal",
  "dean",
  "instructor",
] as const;

export async function reportsRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────────────────
  // IT Reports (SR-F-031)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /reports/it
  app.get(
    "/reports/it",
    { preHandler: requireRole(...ALL_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ITReportQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { industrial_training_id, report_type, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const result = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tenantId];

        if (industrial_training_id) {
          params.push(industrial_training_id);
          conditions.push(`r.industrial_training_id = $${params.length}`);
        }
        if (report_type) {
          params.push(report_type);
          conditions.push(`r.report_type = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
        params.push(limit, offset);

        return client.query(
          `SELECT r.*,
                  it.company, it.student_id,
                  s.first_name, s.last_name
           FROM app.it_reports r
           LEFT JOIN app.industrial_training it ON it.id = r.industrial_training_id
           LEFT JOIN app.students s ON s.id = it.student_id
           WHERE r.tenant_id = $1 ${where}
           ORDER BY r.created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return result.rows;
    },
  );

  // GET /reports/it/:id
  app.get<{ Params: { id: string } }>(
    "/reports/it/:id",
    { preHandler: requireRole(...ALL_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT r.*,
                  it.company, it.student_id,
                  s.first_name, s.last_name
           FROM app.it_reports r
           LEFT JOIN app.industrial_training it ON it.id = r.industrial_training_id
           LEFT JOIN app.students s ON s.id = it.student_id
           WHERE r.tenant_id = $1 AND r.id = $2`,
          [tenantId, req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "IT report not found" });
      return row.rows[0];
    },
  );

  // POST /reports/it
  app.post(
    "/reports/it",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateITReportSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;
      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.it_reports
             (tenant_id, industrial_training_id, report_type, period,
              summary, challenges, recommendations, rating,
              submitted_by, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            tenantId,
            d.industrial_training_id,
            d.report_type,
            d.period,
            d.summary ?? null,
            d.challenges ?? null,
            d.recommendations ?? null,
            d.rating ?? null,
            d.submitted_by ?? null,
            d.submitted_at ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Teacher Evaluations (SR-F-032)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /reports/evaluations
  app.get(
    "/reports/evaluations",
    { preHandler: requireRole(...MANAGEMENT_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = EvaluationQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { staff_id, student_id, academic_period, page, limit } =
        parsed.data;
      const offset = (page - 1) * limit;

      const result = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tenantId];

        if (staff_id) {
          params.push(staff_id);
          conditions.push(`e.staff_id = $${params.length}`);
        }
        if (student_id) {
          params.push(student_id);
          conditions.push(`e.student_id = $${params.length}`);
        }
        if (academic_period) {
          params.push(academic_period);
          conditions.push(`e.academic_period = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
        params.push(limit, offset);

        return client.query(
          `SELECT e.*,
                  sp.full_name AS staff_name,
                  s.first_name, s.last_name
           FROM app.teacher_evaluations e
           LEFT JOIN app.staff_profiles sp ON sp.id = e.staff_id
           LEFT JOIN app.students s ON s.id = e.student_id
           WHERE e.tenant_id = $1 ${where}
           ORDER BY e.submitted_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return result.rows;
    },
  );

  // GET /reports/evaluations/:id
  app.get<{ Params: { id: string } }>(
    "/reports/evaluations/:id",
    { preHandler: requireRole(...MANAGEMENT_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT e.*,
                  sp.full_name AS staff_name,
                  s.first_name, s.last_name
           FROM app.teacher_evaluations e
           LEFT JOIN app.staff_profiles sp ON sp.id = e.staff_id
           LEFT JOIN app.students s ON s.id = e.student_id
           WHERE e.tenant_id = $1 AND e.id = $2`,
          [tenantId, req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "Evaluation not found" });
      return row.rows[0];
    },
  );

  // POST /reports/evaluations
  app.post(
    "/reports/evaluations",
    { preHandler: requireRole(...ALL_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateEvaluationSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;
      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.teacher_evaluations
             (tenant_id, student_id, staff_id, academic_period, scores, comments)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            tenantId,
            d.student_id,
            d.staff_id,
            d.academic_period,
            JSON.stringify(d.scores),
            d.comments ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Instructor Reports (SR-F-033)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /reports/instructor
  app.get(
    "/reports/instructor",
    { preHandler: requireRole(...INSTRUCTOR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = InstructorReportQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { staff_id, report_type, status, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const result = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tenantId];

        if (staff_id) {
          params.push(staff_id);
          conditions.push(`ir.staff_id = $${params.length}`);
        }
        if (report_type) {
          params.push(report_type);
          conditions.push(`ir.report_type = $${params.length}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`ir.status = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
        params.push(limit, offset);

        return client.query(
          `SELECT ir.*, sp.full_name AS staff_name
           FROM app.instructor_reports ir
           LEFT JOIN app.staff_profiles sp ON sp.id = ir.staff_id
           WHERE ir.tenant_id = $1 ${where}
           ORDER BY ir.created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return result.rows;
    },
  );

  // GET /reports/instructor/:id
  app.get<{ Params: { id: string } }>(
    "/reports/instructor/:id",
    { preHandler: requireRole(...INSTRUCTOR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ir.*, sp.full_name AS staff_name
           FROM app.instructor_reports ir
           LEFT JOIN app.staff_profiles sp ON sp.id = ir.staff_id
           WHERE ir.tenant_id = $1 AND ir.id = $2`,
          [tenantId, req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "Instructor report not found" });
      return row.rows[0];
    },
  );

  // POST /reports/instructor
  app.post(
    "/reports/instructor",
    { preHandler: requireRole("admin", "hod", "instructor") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateInstructorReportSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;
      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.instructor_reports
             (tenant_id, staff_id, report_type, period, content, due_date)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            tenantId,
            d.staff_id,
            d.report_type,
            d.period,
            d.content ?? null,
            d.due_date ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /reports/instructor/:id
  app.patch<{ Params: { id: string } }>(
    "/reports/instructor/:id",
    { preHandler: requireRole("admin", "hod", "instructor") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateInstructorReportSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const data = parsed.data;
      const fields = (
        Object.keys(data) as (keyof typeof data)[]
      ).filter((k) => data[k] !== undefined);
      if (fields.length === 0)
        return reply.status(422).send({ error: "No fields to update" });

      const extra: string[] = [];
      if (data.status === "submitted" && !data.submitted_at) {
        extra.push(`submitted_at = now()`);
      }

      const setClauses = [
        ...fields.map((f, i) => `${f} = $${i + 2}`),
        "updated_at = now()",
        ...extra,
      ].join(", ");

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.instructor_reports
           SET ${setClauses}
           WHERE id = $1
           RETURNING *`,
          [req.params.id, ...fields.map((f) => data[f])],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "Instructor report not found" });
      return row.rows[0];
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CAT Export CSV (SR-F-005) — GET /reports/cat-export
  // ─────────────────────────────────────────────────────────────────────────────
  app.get(
    "/reports/cat-export",
    { preHandler: requireRole(...MANAGEMENT_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const rows = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT
             s.id AS student_id,
             s.admission_number,
             s.first_name,
             s.last_name,
             s.programme,
             ms.course_id,
             ms.term,
             ms.intake,
             me.score,
             wi.current_state AS submission_state
           FROM app.students s
           LEFT JOIN app.mark_entries me ON me.tenant_id = $1
             AND me.student_id = s.id
           LEFT JOIN app.mark_submissions ms ON ms.id = me.submission_id
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'marks' AND wi.entity_id = ms.id
           WHERE s.tenant_id = $1 AND s.is_active = true
           ORDER BY s.last_name, s.first_name, ms.term, ms.course_id`,
          [tid],
        );
        return rows;
      });

      const CSV_COLS = [
        "student_id",
        "admission_number",
        "first_name",
        "last_name",
        "programme",
        "course_id",
        "term",
        "intake",
        "score",
        "submission_state",
      ];

      const escapeCsv = (v: unknown): string => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const header = CSV_COLS.join(",");
      const body = rows
        .map((r: Record<string, unknown>) =>
          CSV_COLS.map((c) => escapeCsv(r[c])).join(","),
        )
        .join("\n");

      const csv = `${header}\n${body}`;

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="cat-export.csv"',
        )
        .send(csv);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Dropout Cohort Progression Report (SR-F-003) — GET /reports/dropout-cohort
  // ─────────────────────────────────────────────────────────────────────────────
  app.get(
    "/reports/dropout-cohort",
    { preHandler: requireRole(...MANAGEMENT_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const result = await withTenant(tid, async (client) => {
        // Dropout counts by programme
        const { rows: byProgramme } = await client.query(
          `SELECT programme, COUNT(*) AS count
           FROM app.students
           WHERE tenant_id = $1 AND is_active = false AND dropout_reason IS NOT NULL
           GROUP BY programme
           ORDER BY count DESC`,
          [tid],
        );

        // Dropout counts by reason
        const { rows: byReason } = await client.query(
          `SELECT dropout_reason AS reason, COUNT(*) AS count
           FROM app.students
           WHERE tenant_id = $1 AND is_active = false AND dropout_reason IS NOT NULL
           GROUP BY dropout_reason
           ORDER BY count DESC`,
          [tid],
        );

        // Dropout counts by period (month)
        const { rows: byPeriod } = await client.query(
          `SELECT
             to_char(dropout_date, 'YYYY-MM') AS period,
             COUNT(*) AS count
           FROM app.students
           WHERE tenant_id = $1 AND is_active = false AND dropout_date IS NOT NULL
           GROUP BY period
           ORDER BY period DESC`,
          [tid],
        );

        // Cohort progression summary
        const { rows: cohort } = await client.query(
          `SELECT
             COUNT(*) AS total_students,
             COUNT(*) FILTER (WHERE is_active = true)  AS active,
             COUNT(*) FILTER (WHERE is_active = false AND dropout_reason IS NOT NULL) AS dropped,
             COUNT(*) FILTER (WHERE is_active = false AND dropout_reason IS NULL) AS deactivated
           FROM app.students
           WHERE tenant_id = $1`,
          [tid],
        );

        return {
          by_programme: byProgramme.map((r) => ({
            programme: r.programme ?? "unspecified",
            count: Number(r.count),
          })),
          by_reason: byReason.map((r) => ({
            reason: r.reason,
            count: Number(r.count),
          })),
          by_period: byPeriod.map((r) => ({
            period: r.period ?? "unknown",
            count: Number(r.count),
          })),
          cohort: {
            total: Number(cohort[0]?.total_students ?? 0),
            active: Number(cohort[0]?.active ?? 0),
            dropped: Number(cohort[0]?.dropped ?? 0),
            deactivated: Number(cohort[0]?.deactivated ?? 0),
          },
        };
      });

      return result;
    },
  );
}

