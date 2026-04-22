import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  SignOffSchema,
  ClearanceQuerySchema,
  DEPARTMENTS,
} from "./clearance.schema.js";

export async function clearanceRoutes(app: FastifyInstance) {
  // ---------- GET /clearance — list sign-offs (with optional filters)
  app.get(
    "/clearance",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "principal",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ClearanceQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, term_id, department, status } = parsed.data;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (student_id) {
          params.push(student_id);
          conditions.push(`c.student_id = $${params.length}`);
        }
        if (term_id) {
          params.push(term_id);
          conditions.push(`c.term_id = $${params.length}`);
        }
        if (department) {
          params.push(department);
          conditions.push(`c.department = $${params.length}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`c.status = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        return client.query(
          `SELECT c.*, s.first_name, s.last_name, s.admission_number
           FROM app.clearance_signoffs c
           LEFT JOIN app.students s ON s.id = c.student_id
           WHERE c.tenant_id = $1 ${where}
           ORDER BY c.created_at DESC`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // ---------- GET /clearance/student/:studentId/term/:termId — full clearance status for one student + term
  app.get<{ Params: { studentId: string; termId: string } }>(
    "/clearance/student/:studentId/term/:termId",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "principal",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId, termId } = req.params;

      const result = await withTenant(tid, async (client) => {
        const { rows: existing } = await client.query(
          `SELECT department, status, signed_by, signed_at, remarks
           FROM app.clearance_signoffs
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
          [tid, studentId, termId],
        );

        // Build map of all 8 departments with their status
        const signoffs: Record<
          string,
          { status: string; signed_by: string | null; signed_at: string | null; remarks: string | null }
        > = {};
        for (const dept of DEPARTMENTS) {
          const row = existing.find((r: { department: string }) => r.department === dept);
          signoffs[dept] = row
            ? {
                status: row.status,
                signed_by: row.signed_by,
                signed_at: row.signed_at,
                remarks: row.remarks,
              }
            : { status: "PENDING", signed_by: null, signed_at: null, remarks: null };
        }

        const completedCount = Object.values(signoffs).filter(
          (s) => s.status === "SIGNED",
        ).length;

        return {
          student_id: studentId,
          term_id: termId,
          departments: signoffs,
          completed: completedCount,
          total: DEPARTMENTS.length,
          fully_cleared: completedCount === DEPARTMENTS.length,
        };
      });

      return result;
    },
  );

  // ---------- POST /clearance/sign-off — sign or reject a department
  app.post(
    "/clearance/sign-off",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = SignOffSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, term_id, department, status, remarks } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const row = await withTenant(tid, async (client) => {
        // Verify student exists
        const { rows: stuRows } = await client.query(
          `SELECT id FROM app.students WHERE id = $1`,
          [student_id],
        );
        if (!stuRows[0]) return { notFound: true, message: "student not found" } as const;

        // Upsert sign-off
        const { rows } = await client.query(
          `INSERT INTO app.clearance_signoffs
             (tenant_id, student_id, term_id, department, status, signed_by, signed_at, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
           ON CONFLICT (tenant_id, student_id, term_id, department)
           DO UPDATE SET status = EXCLUDED.status,
                         signed_by = EXCLUDED.signed_by,
                         signed_at = now(),
                         remarks = EXCLUDED.remarks
           RETURNING *`,
          [tid, student_id, term_id, department, status, actorUserId, remarks ?? null],
        );

        return rows[0];
      });

      if (row && "notFound" in row)
        return reply.status(404).send({ error: row.message });

      return reply.status(201).send(row);
    },
  );

  // ---------- POST /clearance/init — initialise all 8 PENDING sign-offs for a student+term
  app.post<{ Body: { student_id: string; term_id: string } }>(
    "/clearance/init",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { student_id, term_id } = req.body ?? {};
      if (!student_id || !term_id)
        return reply
          .status(422)
          .send({ error: "student_id and term_id required" });

      const rows = await withTenant(tid, async (client) => {
        const inserted = [];
        for (const dept of DEPARTMENTS) {
          const { rows } = await client.query(
            `INSERT INTO app.clearance_signoffs
               (tenant_id, student_id, term_id, department, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             ON CONFLICT (tenant_id, student_id, term_id, department) DO NOTHING
             RETURNING *`,
            [tid, student_id, term_id, dept],
          );
          if (rows[0]) inserted.push(rows[0]);
        }
        return inserted;
      });

      return reply.status(201).send({ initialized: rows.length });
    },
  );
}
