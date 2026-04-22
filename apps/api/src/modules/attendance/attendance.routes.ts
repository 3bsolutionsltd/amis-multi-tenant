import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";

const WRITE_ROLES = ["admin", "registrar", "hod", "instructor"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "principal",
  "dean",
] as const;

const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

const AttendanceQuerySchema = z.object({
  course_id: z.string().optional(),
  student_id: z.string().uuid().optional(),
  programme: z.string().optional(),
  academic_year: z.string().optional(),
  term_number: z.coerce.number().int().min(1).max(4).optional(),
  date: z.string().optional(), // YYYY-MM-DD
});

const BatchAttendanceItemSchema = z.object({
  student_id: z.string().uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().max(500).optional(),
});

const BatchAttendanceSchema = z.object({
  course_id: z.string().min(1).max(100),
  programme: z.string().min(1).max(200),
  academic_year: z.string().min(1).max(20),
  term_number: z.number().int().min(1).max(4),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  records: z.array(BatchAttendanceItemSchema).min(1).max(500),
});

const AttendanceSummaryQuerySchema = z.object({
  programme: z.string().optional(),
  academic_year: z.string().optional(),
  term_number: z.coerce.number().int().min(1).max(4).optional(),
  course_id: z.string().optional(),
  student_id: z.string().uuid().optional(),
});

export async function attendanceRoutes(app: FastifyInstance) {
  // ── GET /attendance ──────────────────────────────────────────────────────
  app.get(
    "/attendance",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = AttendanceQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { course_id, student_id, programme, academic_year, term_number, date } =
        parsed.data;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (course_id) {
          params.push(course_id);
          conditions.push(`a.course_id = $${params.length}`);
        }
        if (student_id) {
          params.push(student_id);
          conditions.push(`a.student_id = $${params.length}`);
        }
        if (programme) {
          params.push(programme);
          conditions.push(`a.programme = $${params.length}`);
        }
        if (academic_year) {
          params.push(academic_year);
          conditions.push(`a.academic_year = $${params.length}`);
        }
        if (term_number != null) {
          params.push(term_number);
          conditions.push(`a.term_number = $${params.length}`);
        }
        if (date) {
          params.push(date);
          conditions.push(`a.date = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const { rows } = await client.query(
          `SELECT a.id, a.student_id,
                  s.first_name, s.last_name, s.admission_number,
                  a.course_id, a.programme, a.academic_year,
                  a.term_number, a.date, a.status, a.notes,
                  a.created_at
           FROM app.attendance a
           JOIN app.students s ON s.id = a.student_id
           ${where}
           ORDER BY a.date DESC, s.last_name, s.first_name`,
          params
        );
        return rows;
      });

      return reply.send(rows);
    }
  );

  // ── POST /attendance/batch ───────────────────────────────────────────────
  // Upsert a full day's attendance for a course (insert or update on conflict)
  app.post(
    "/attendance/batch",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = BatchAttendanceSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { course_id, programme, academic_year, term_number, date, records } =
        parsed.data;

      const saved = await withTenant(tid, async (client) => {
        const inserted: unknown[] = [];
        for (const rec of records) {
          const { rows } = await client.query(
            `INSERT INTO app.attendance
               (tenant_id, student_id, course_id, programme,
                academic_year, term_number, date, status, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (tenant_id, student_id, course_id, date)
             DO UPDATE SET
               status = EXCLUDED.status,
               notes  = EXCLUDED.notes,
               updated_at = NOW()
             RETURNING id, student_id, course_id, date, status, notes`,
            [
              tid,
              rec.student_id,
              course_id,
              programme,
              academic_year,
              term_number,
              date,
              rec.status,
              rec.notes ?? null,
            ]
          );
          inserted.push(...rows);
        }
        return inserted;
      });

      return reply.status(201).send({ saved: saved.length, records: saved });
    }
  );

  // ── GET /attendance/summary ──────────────────────────────────────────────
  // Per-student attendance counts for a course/term
  app.get(
    "/attendance/summary",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = AttendanceSummaryQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { programme, academic_year, term_number, course_id, student_id } =
        parsed.data;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (programme) {
          params.push(programme);
          conditions.push(`a.programme = $${params.length}`);
        }
        if (academic_year) {
          params.push(academic_year);
          conditions.push(`a.academic_year = $${params.length}`);
        }
        if (term_number != null) {
          params.push(term_number);
          conditions.push(`a.term_number = $${params.length}`);
        }
        if (course_id) {
          params.push(course_id);
          conditions.push(`a.course_id = $${params.length}`);
        }
        if (student_id) {
          params.push(student_id);
          conditions.push(`a.student_id = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const { rows } = await client.query(
          `SELECT
             a.student_id,
             s.first_name, s.last_name, s.admission_number,
             COUNT(*) FILTER (WHERE a.status = 'present')  AS present,
             COUNT(*) FILTER (WHERE a.status = 'absent')   AS absent,
             COUNT(*) FILTER (WHERE a.status = 'late')     AS late,
             COUNT(*) FILTER (WHERE a.status = 'excused')  AS excused,
             COUNT(*) AS total
           FROM app.attendance a
           JOIN app.students s ON s.id = a.student_id
           ${where}
           GROUP BY a.student_id, s.first_name, s.last_name, s.admission_number
           ORDER BY s.last_name, s.first_name`,
          params
        );
        return rows;
      });

      return reply.send(rows);
    }
  );

  // ── DELETE /attendance/:id ───────────────────────────────────────────────
  app.delete(
    "/attendance/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params as { id: string };

      await withTenant(tid, async (client) => {
        await client.query(
          `DELETE FROM app.attendance WHERE id = $1`,
          [id]
        );
      });

      return reply.status(204).send();
    }
  );
}
