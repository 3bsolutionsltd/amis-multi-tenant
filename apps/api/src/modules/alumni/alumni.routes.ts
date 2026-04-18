import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  GraduateStudentSchema,
  AlumniQuerySchema,
} from "./alumni.schema.js";

const ALUMNI_COLS =
  "id, tenant_id, student_id, first_name, last_name, programme, admission_number, " +
  "graduation_date, graduation_notes, graduated_by, created_at";

const ADMIN_ROLES = ["admin", "registrar"] as const;
const WIDE_ROLES = ["admin", "registrar", "hod", "principal", "dean"] as const;

export async function alumniRoutes(app: FastifyInstance) {
  // POST /students/:id/graduate — transition student to alumni (SR-F-011)
  app.post<{ Params: { id: string } }>(
    "/students/:id/graduate",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = GraduateStudentSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { graduation_date, graduation_notes } = parsed.data;
      const actorUserId = req.user?.userId ?? null;
      const studentId = req.params.id;

      const result = await withTenant(tid, async (client) => {
        // Find the student
        const { rows: stuRows } = await client.query(
          `SELECT id, first_name, last_name, programme, admission_number, is_active
           FROM app.students WHERE id = $1`,
          [studentId],
        );
        if (stuRows.length === 0) return { notFound: true } as const;

        const student = stuRows[0] as {
          id: string;
          first_name: string;
          last_name: string;
          programme: string | null;
          admission_number: string | null;
          is_active: boolean;
        };

        if (!student.is_active)
          return { alreadyInactive: true } as const;

        // Insert into alumni
        const { rows: alumniRows } = await client.query(
          `INSERT INTO app.alumni
             (tenant_id, student_id, first_name, last_name, programme, admission_number,
              graduation_date, graduation_notes, graduated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING ${ALUMNI_COLS}`,
          [
            tid,
            studentId,
            student.first_name,
            student.last_name,
            student.programme,
            student.admission_number,
            graduation_date,
            graduation_notes ?? null,
            actorUserId,
          ],
        );

        // Deactivate student
        await client.query(
          `UPDATE app.students
           SET is_active = false, updated_at = now()
           WHERE id = $1`,
          [studentId],
        );

        return { alumni: alumniRows[0] };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });
      if ("alreadyInactive" in result)
        return reply
          .status(409)
          .send({ error: "student is already inactive" });

      return reply.status(201).send(result);
    },
  );

  // GET /alumni — list with search + pagination
  app.get(
    "/alumni",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = AlumniQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { search, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

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
          `SELECT ${ALUMNI_COLS} FROM app.alumni
           ${where}
           ORDER BY graduation_date DESC, last_name
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /alumni/:id — single record
  app.get<{ Params: { id: string } }>(
    "/alumni/:id",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT ${ALUMNI_COLS} FROM app.alumni WHERE id = $1`,
          [req.params.id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // GET /alumni/export/csv — CSV export
  app.get(
    "/alumni/export/csv",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const rows = await withTenant(tid, async (client) => {
        return client.query(
          `SELECT ${ALUMNI_COLS} FROM app.alumni
           ORDER BY graduation_date DESC, last_name`,
        );
      });

      const CSV_COLS = [
        "id",
        "student_id",
        "first_name",
        "last_name",
        "programme",
        "admission_number",
        "graduation_date",
        "graduation_notes",
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
          'attachment; filename="alumni-export.csv"',
        )
        .send(csv);
    },
  );
}
