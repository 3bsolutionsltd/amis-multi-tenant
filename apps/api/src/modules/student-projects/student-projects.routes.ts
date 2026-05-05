import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateStudentProjectSchema,
  UpdateStudentProjectSchema,
  StudentProjectQuerySchema,
} from "./student-projects.schema.js";

const READ_ROLES = ["admin", "registrar", "hod", "instructor", "principal", "finance"] as const;
const WRITE_ROLES = ["admin", "registrar", "hod", "instructor"] as const;

const PROJECT_COLS = "id, student_id, term_id, course_id, project_title, description, status, mark_entry_id, created_by, created_at, updated_at";

export async function studentProjectsRoutes(app: FastifyInstance) {
  // ---------- GET /student-projects
  app.get(
    "/student-projects",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = StudentProjectQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, term_id, status, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
        if (term_id) { params.push(term_id); conditions.push(`p.term_id = $${params.length}`); }
        if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit, offset);

        const { rows: data } = await client.query(
          `SELECT p.${PROJECT_COLS.split(", ").join(", p.")},
                  s.first_name || ' ' || s.last_name AS student_name
           FROM app.student_projects p
           LEFT JOIN app.students s ON s.id = p.student_id
           ${where}
           ORDER BY p.created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
        return data;
      });

      return rows;
    },
  );

  // ---------- POST /student-projects
  app.post(
    "/student-projects",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateStudentProjectSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.student_projects
             (tenant_id, student_id, term_id, course_id, project_title, description, status, mark_entry_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING ${PROJECT_COLS}`,
          [
            tid,
            d.student_id,
            d.term_id ?? null,
            d.course_id ?? null,
            d.project_title,
            d.description ?? null,
            d.status,
            d.mark_entry_id ?? null,
            actorUserId,
          ],
        );
        return rows[0];
      });

      return reply.status(201).send(row);
    },
  );

  // ---------- GET /student-projects/:id
  app.get<{ Params: { id: string } }>(
    "/student-projects/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const data = await withTenant(tid, async (client) => {
        // Project detail + linked issuances
        const { rows: proj } = await client.query(
          `SELECT p.${PROJECT_COLS.split(", ").join(", p.")},
                  s.first_name || ' ' || s.last_name AS student_name
           FROM app.student_projects p
           LEFT JOIN app.students s ON s.id = p.student_id
           WHERE p.id = $1`,
          [id],
        );
        if (!proj[0]) return null;

        const { rows: issuances } = await client.query(
          `SELECT i.id, i.issuance_number, i.purpose, i.status, i.issue_date,
                  i.issued_to, i.notes
           FROM app.store_issuances i
           WHERE i.student_project_id = $1
           ORDER BY i.issue_date DESC`,
          [id],
        );

        return { ...proj[0], issuances };
      });

      if (!data) return reply.status(404).send({ error: "Student project not found" });
      return data;
    },
  );

  // ---------- PATCH /student-projects/:id
  app.patch<{ Params: { id: string } }>(
    "/student-projects/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateStudentProjectSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const d = parsed.data;
      const fields: string[] = [];
      const params: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
      };
      addField("project_title", d.project_title);
      addField("description", d.description);
      addField("status", d.status);
      addField("term_id", d.term_id);
      addField("course_id", d.course_id);
      addField("mark_entry_id", d.mark_entry_id);

      if (!fields.length) return reply.status(422).send({ error: "No fields to update" });

      params.push(id);
      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `UPDATE app.student_projects
           SET ${fields.join(", ")}, updated_at = now()
           WHERE id = $${params.length}
           RETURNING ${PROJECT_COLS}`,
          params,
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "Student project not found" });
      return row;
    },
  );

  // ---------- GET /student-projects/:id/costing
  app.get<{ Params: { id: string } }>(
    "/student-projects/:id/costing",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const data = await withTenant(tid, async (client) => {
        // Verify project exists
        const { rows: proj } = await client.query(
          `SELECT id, project_title FROM app.student_projects WHERE id = $1`,
          [id],
        );
        if (!proj[0]) return null;

        // Itemised cost: all issuances linked to this project → their line items → inventory item cost
        const { rows: items } = await client.query(
          `SELECT
             inv.name             AS item_name,
             inv.unit_of_measure  AS unit,
             SUM(si.quantity_issued)                          AS total_qty,
             COALESCE(inv.unit_cost, 0)                       AS unit_cost,
             COALESCE(inv.unit_cost, 0) * SUM(si.quantity_issued) AS line_total,
             iss.issuance_number,
             iss.issue_date
           FROM app.store_issuances iss
           JOIN app.store_issuance_items si ON si.issuance_id = iss.id
           JOIN app.inventory_items inv ON inv.id = si.item_id
           WHERE iss.student_project_id = $1
             AND iss.status = 'issued'
           GROUP BY inv.id, inv.name, inv.unit_of_measure, inv.unit_cost,
                    iss.issuance_number, iss.issue_date
           ORDER BY iss.issue_date, inv.name`,
          [id],
        );

        const grandTotal = items.reduce(
          (sum: number, row: { line_total: string }) => sum + parseFloat(row.line_total ?? "0"),
          0,
        );

        return {
          project_id: id,
          project_title: proj[0].project_title,
          line_items: items,
          grand_total: Math.round(grandTotal * 100) / 100,
        };
      });

      if (!data) return reply.status(404).send({ error: "Student project not found" });
      return data;
    },
  );
}
