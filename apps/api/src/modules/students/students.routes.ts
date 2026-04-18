import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  DeactivateStudentSchema,
  StudentsQuerySchema,
  type CreateStudent,
  type UpdateStudent,
  type DeactivateStudent,
} from "./students.schema.js";

const SELECT_COLS =
  "id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone, extension, " +
  "guardian_name, guardian_phone, guardian_email, guardian_relationship, " +
  "dropout_reason, dropout_date, dropout_notes, " +
  "is_active, created_at, updated_at";

export async function studentsRoutes(app: FastifyInstance) {
  const WIDE_ROLES = [
    "admin",
    "registrar",
    "hod",
    "instructor",
    "finance",
    "principal",
    "dean",
  ] as const;

  // GET /students — search + paginated list
  app.get(
    "/students",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = StudentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const { search, include_inactive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push(`is_active = true`);
        }

        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`,
          );
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${SELECT_COLS} FROM app.students
           ${where}
           ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /students/:id — 360° student view (SR-F-008)
  app.get<{ Params: { id: string } }>(
    "/students/:id",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const result = await withTenant(tenantId, async (client) => {
        // Core student record
        const { rows: stuRows } = await client.query(
          `SELECT ${SELECT_COLS} FROM app.students WHERE id = $1`,
          [req.params.id],
        );
        if (stuRows.length === 0) return null;

        const student = stuRows[0];
        const sid = req.params.id;

        // Marks summary — latest marks per submission
        const { rows: marks } = await client.query(
          `SELECT ms.course_id, ms.term, ms.intake, me.score,
                  wi.current_state AS submission_state
           FROM app.mark_entries me
           JOIN app.mark_submissions ms ON ms.id = me.submission_id
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'marks' AND wi.entity_id = ms.id
           WHERE me.student_id = $1
           ORDER BY ms.term DESC, ms.course_id`,
          [sid],
        );

        // Admissions history
        const { rows: admissions } = await client.query(
          `SELECT a.id, a.programme, a.intake,
                  wi.current_state
           FROM app.admission_applications a
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'admissions' AND wi.entity_id = a.id
           WHERE a.tenant_id = $1
             AND a.first_name = $2 AND a.last_name = $3
           ORDER BY a.created_at DESC`,
          [tenantId, student.first_name, student.last_name],
        );

        // Term registrations
        const { rows: termRegs } = await client.query(
          `SELECT r.id, r.academic_year, r.term, r.created_at,
                  wi.current_state
           FROM app.term_registrations r
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'term_registration' AND wi.entity_id = r.id
           WHERE r.student_id = $1
           ORDER BY r.created_at DESC`,
          [sid],
        );

        // Industrial training
        const { rows: itRecords } = await client.query(
          `SELECT id, company, status, start_date, end_date
           FROM app.industrial_training
           WHERE student_id = $1
           ORDER BY start_date DESC`,
          [sid],
        );

        // Field placements
        const { rows: fpRecords } = await client.query(
          `SELECT id, school_name, status, start_date, end_date
           FROM app.field_placements
           WHERE student_id = $1
           ORDER BY start_date DESC`,
          [sid],
        );

        // Fee summary
        const { rows: feeRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid, MAX(paid_at) AS last_payment
           FROM app.payments WHERE student_id = $1`,
          [sid],
        );

        return {
          ...student,
          marks,
          admissions,
          term_registrations: termRegs,
          industrial_training: itRecords,
          field_placements: fpRecords,
          fees: {
            total_paid: Number(feeRows[0]?.total_paid ?? 0),
            last_payment: feeRows[0]?.last_payment ?? null,
          },
        };
      });

      if (!result) {
        return reply.status(404).send({ error: "student not found" });
      }

      return result;
    },
  );

  // POST /students — create (registrar, admin only)
  app.post<{ Body: CreateStudent }>(
    "/students",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = CreateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const {
        first_name,
        last_name,
        date_of_birth,
        admission_number,
        sponsorship_type,
        programme,
        email,
        phone,
        extension,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone, extension,
              guardian_name, guardian_phone, guardian_email, guardian_relationship)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING ${SELECT_COLS}`,
          [
            tenantId,
            first_name,
            last_name,
            date_of_birth ?? null,
            admission_number ?? null,
            sponsorship_type ?? null,
            programme ?? null,
            email ?? null,
            phone ?? null,
            JSON.stringify(extension ?? {}),
            guardian_name ?? null,
            guardian_phone ?? null,
            guardian_email ?? null,
            guardian_relationship ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PUT /students/:id — update (registrar, admin only)
  app.put<{ Params: { id: string }; Body: UpdateStudent }>(
    "/students/:id",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = UpdateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const {
        first_name,
        last_name,
        date_of_birth,
        admission_number,
        sponsorship_type,
        programme,
        email,
        phone,
        extension,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET
             first_name            = COALESCE($2, first_name),
             last_name             = COALESCE($3, last_name),
             date_of_birth         = COALESCE($4::date, date_of_birth),
             admission_number      = COALESCE($5, admission_number),
             sponsorship_type      = COALESCE($6, sponsorship_type),
             programme             = COALESCE($7, programme),
             email                 = COALESCE($8, email),
             phone                 = COALESCE($9, phone),
             extension             = COALESCE($10::jsonb, extension),
             guardian_name         = COALESCE($11, guardian_name),
             guardian_phone        = COALESCE($12, guardian_phone),
             guardian_email        = COALESCE($13, guardian_email),
             guardian_relationship = COALESCE($14, guardian_relationship),
             updated_at            = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [
            req.params.id,
            first_name ?? null,
            last_name ?? null,
            date_of_birth ?? null,
            admission_number ?? null,
            sponsorship_type ?? null,
            programme ?? null,
            email ?? null,
            phone ?? null,
            extension !== undefined ? JSON.stringify(extension) : null,
            guardian_name ?? null,
            guardian_phone ?? null,
            guardian_email ?? null,
            guardian_relationship ?? null,
          ],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // PATCH /students/:id/deactivate — soft-delete with optional dropout info (admin, registrar only)
  app.patch<{ Params: { id: string }; Body: DeactivateStudent }>(
    "/students/:id/deactivate",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = DeactivateStudentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const { dropout_reason, dropout_date, dropout_notes } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET is_active      = false,
               dropout_reason = COALESCE($2, dropout_reason),
               dropout_date   = COALESCE($3::date, dropout_date),
               dropout_notes  = COALESCE($4, dropout_notes),
               updated_at     = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [
            req.params.id,
            dropout_reason ?? null,
            dropout_date ?? null,
            dropout_notes ?? null,
          ],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // PATCH /students/:id/reactivate — restore (admin, registrar only)
  app.patch<{ Params: { id: string } }>(
    "/students/:id/reactivate",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET is_active = true, updated_at = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /students/export/csv — SR-F-005 CSV export
  // ─────────────────────────────────────────────────────────────────────────────
  app.get(
    "/students/export/csv",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const rows = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${SELECT_COLS} FROM app.students
           WHERE tenant_id = $1
           ORDER BY last_name, first_name`,
          [tenantId],
        ),
      );

      const CSV_COLS = [
        "id",
        "first_name",
        "last_name",
        "date_of_birth",
        "admission_number",
        "sponsorship_type",
        "programme",
        "email",
        "phone",
        "guardian_name",
        "guardian_phone",
        "guardian_email",
        "guardian_relationship",
        "is_active",
        "dropout_reason",
        "dropout_date",
        "created_at",
      ];

      const escapeCsv = (v: unknown): string => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const header = CSV_COLS.join(",");
      const body = rows.rows
        .map((r: Record<string, unknown>) =>
          CSV_COLS.map((c) => escapeCsv(r[c])).join(","),
        )
        .join("\n");

      const csv = `${header}\n${body}`;

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="students-export.csv"',
        )
        .send(csv);
    },
  );
}

