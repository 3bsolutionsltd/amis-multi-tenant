import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateIndustrialTrainingSchema,
  UpdateIndustrialTrainingSchema,
  IndustrialTrainingQuerySchema,
  SetSupervisorPinSchema,
  CreateLogEntrySchema,
  UpdateLogEntrySchema,
  VerifyLogEntrySchema,
  LogQuerySchema,
  GhostDetectionQuerySchema,
} from "./industrial-training.schema.js";

export async function industrialTrainingRoutes(app: FastifyInstance) {
  // ---------- GET /industrial-training
  app.get(
    "/industrial-training",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "instructor",
        "principal",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = IndustrialTrainingQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, status, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (student_id) {
          params.push(student_id);
          conditions.push(`it.student_id = $${params.length}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`it.status = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        const limitIdx = params.length - 1;
        const offsetIdx = params.length;

        const { rows: data } = await client.query(
          `SELECT it.*,
                  s.first_name, s.last_name
           FROM app.industrial_training it
           LEFT JOIN app.students s ON s.id = it.student_id
           WHERE it.tenant_id = $1 ${where}
           ORDER BY it.created_at DESC
           LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          params,
        );
        return data;
      });

      return rows;
    },
  );

  // ---------- GET /industrial-training/:id
  app.get<{ Params: { id: string } }>(
    "/industrial-training/:id",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "instructor",
        "principal",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT it.*,
                  s.first_name, s.last_name
           FROM app.industrial_training it
           LEFT JOIN app.students s ON s.id = it.student_id
           WHERE it.id = $1`,
          [id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // ---------- POST /industrial-training
  app.post(
    "/industrial-training",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateIndustrialTrainingSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        student_id,
        company,
        supervisor,
        department,
        start_date,
        end_date,
        status,
        notes,
      } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.industrial_training
             (tenant_id, student_id, company, supervisor, department,
              start_date, end_date, status, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            tid,
            student_id,
            company,
            supervisor ?? null,
            department ?? null,
            start_date ?? null,
            end_date ?? null,
            status,
            notes ?? null,
            actorUserId,
          ],
        );
        return rows[0];
      });

      return reply.status(201).send(row);
    },
  );

  // ---------- PATCH /industrial-training/:id
  app.patch<{ Params: { id: string } }>(
    "/industrial-training/:id",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateIndustrialTrainingSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const updates = parsed.data;

      const row = await withTenant(tid, async (client) => {
        const fields: string[] = [];
        const params: unknown[] = [];

        // Gather fields to update
        const allowed = [
          "company",
          "supervisor",
          "department",
          "start_date",
          "end_date",
          "status",
          "notes",
        ] as const;
        for (const key of allowed) {
          if (key in updates) {
            params.push((updates as Record<string, unknown>)[key]);
            fields.push(`${key} = $${params.length}`);
          }
        }
        if (fields.length === 0) return { noChange: true } as const;

        params.push(new Date().toISOString());
        fields.push(`updated_at = $${params.length}`);

        params.push(id);
        const idIdx = params.length;

        const { rows } = await client.query(
          `UPDATE app.industrial_training
           SET ${fields.join(", ")}
           WHERE id = $${idIdx}
           RETURNING *`,
          params,
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      if ("noChange" in row) return reply.status(200).send({ message: "no changes" });
      return row;
    },
  );

  // ==========================================================================
  // IT LOGBOOK
  // ==========================================================================

  // ---------- POST /industrial-training/:id/supervisor-pin
  app.post<{ Params: { id: string } }>(
    "/industrial-training/:id/supervisor-pin",
    { preHandler: requireRole("admin", "registrar", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = SetSupervisorPinSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const pinHash = await bcrypt.hash(parsed.data.pin, 10);

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `UPDATE app.industrial_training
           SET supervisor_pin_hash = $1, updated_at = now()
           WHERE id = $2
           RETURNING id, company, supervisor`,
          [pinHash, id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "IT assignment not found" });
      return reply.send({ message: "Supervisor PIN set successfully", ...row });
    },
  );

  // ---------- GET /industrial-training/:id/logs
  app.get<{ Params: { id: string } }>(
    "/industrial-training/:id/logs",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor", "principal") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = LogQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const { page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const { rows: data } = await client.query(
          `SELECT l.*
           FROM app.it_log_entries l
           WHERE l.it_assignment_id = $1
           ORDER BY l.log_date ASC
           LIMIT $2 OFFSET $3`,
          [id, limit, offset],
        );
        return data;
      });

      return rows;
    },
  );

  // ---------- POST /industrial-training/:id/logs
  app.post<{ Params: { id: string } }>(
    "/industrial-training/:id/logs",
    { preHandler: requireRole("admin", "registrar", "student", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateLogEntrySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const { log_date, task_description, learning_points } = parsed.data;

      const row = await withTenant(tid, async (client) => {
        // Verify the assignment exists and belongs to this tenant
        const { rows: asgn } = await client.query(
          `SELECT id, student_id FROM app.industrial_training WHERE id = $1`,
          [id],
        );
        if (!asgn[0]) throw Object.assign(new Error("IT assignment not found"), { status: 404 });

        const { rows } = await client.query(
          `INSERT INTO app.it_log_entries
             (tenant_id, it_assignment_id, student_id, log_date, task_description, learning_points)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [tid, id, asgn[0].student_id, log_date, task_description, learning_points ?? null],
        );
        return rows[0];
      });

      return reply.status(201).send(row);
    },
  );

  // ---------- PATCH /industrial-training/logs/:logId
  app.patch<{ Params: { logId: string } }>(
    "/industrial-training/logs/:logId",
    { preHandler: requireRole("admin", "registrar", "student", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateLogEntrySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { logId } = req.params;

      const row = await withTenant(tid, async (client) => {
        const { rows: existing } = await client.query(
          `SELECT id, supervisor_verified FROM app.it_log_entries WHERE id = $1`,
          [logId],
        );
        if (!existing[0]) throw Object.assign(new Error("Log entry not found"), { status: 404 });
        if (existing[0].supervisor_verified) {
          throw Object.assign(new Error("Cannot edit a verified log entry"), { status: 409 });
        }

        const fields: string[] = [];
        const params: unknown[] = [];
        const d = parsed.data;
        if (d.task_description !== undefined) {
          params.push(d.task_description);
          fields.push(`task_description = $${params.length}`);
        }
        if (d.learning_points !== undefined) {
          params.push(d.learning_points);
          fields.push(`learning_points = $${params.length}`);
        }
        if (!fields.length) return { noChange: true } as const;

        params.push(logId);
        const { rows } = await client.query(
          `UPDATE app.it_log_entries
           SET ${fields.join(", ")}, updated_at = now()
           WHERE id = $${params.length}
           RETURNING *`,
          params,
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "Log entry not found" });
      if ("noChange" in row) return reply.status(200).send({ message: "no changes" });
      return row;
    },
  );

  // ---------- POST /industrial-training/logs/:logId/verify
  app.post<{ Params: { logId: string } }>(
    "/industrial-training/logs/:logId/verify",
    { preHandler: requireRole("admin", "registrar", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = VerifyLogEntrySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { logId } = req.params;

      const row = await withTenant(tid, async (client) => {
        // Get log entry + assignment's PIN hash in one query
        const { rows } = await client.query(
          `SELECT l.id, l.supervisor_verified, l.it_assignment_id,
                  it.supervisor_pin_hash, it.supervisor AS supervisor_name
           FROM app.it_log_entries l
           JOIN app.industrial_training it ON it.id = l.it_assignment_id
           WHERE l.id = $1`,
          [logId],
        );
        const entry = rows[0];
        if (!entry) throw Object.assign(new Error("Log entry not found"), { status: 404 });
        if (entry.supervisor_verified) {
          throw Object.assign(new Error("Already verified"), { status: 409 });
        }
        if (!entry.supervisor_pin_hash) {
          throw Object.assign(new Error("No supervisor PIN set for this assignment"), { status: 422 });
        }

        const pinOk = await bcrypt.compare(parsed.data.pin, entry.supervisor_pin_hash);
        if (!pinOk) return { wrongPin: true } as const;

        const { rows: updated } = await client.query(
          `UPDATE app.it_log_entries
           SET supervisor_verified = true,
               verified_at = now(),
               verified_by_name = $1,
               verification_method = 'pin',
               updated_at = now()
           WHERE id = $2
           RETURNING *`,
          [entry.supervisor_name ?? "Supervisor", logId],
        );
        return updated[0];
      });

      if ("wrongPin" in row) return reply.status(401).send({ error: "Incorrect PIN" });
      return reply.send(row);
    },
  );

  // ---------- GET /reports/it-ghost-detection?term_id=
  app.get(
    "/reports/it-ghost-detection",
    { preHandler: requireRole("admin", "hod", "principal", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = GhostDetectionQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const { term_id } = parsed.data;

      const rows = await withTenant(tid, async (client) => {
        // Get assignments active in the given term date range
        const { rows: data } = await client.query(
          `SELECT
             it.id,
             it.student_id,
             s.first_name || ' ' || s.last_name AS student_name,
             it.company,
             it.supervisor,
             it.status,
             it.start_date,
             it.end_date,
             COUNT(l.id) AS total_logs,
             COUNT(l.id) FILTER (WHERE l.supervisor_verified = true) AS verified_logs,
             CASE
               WHEN COUNT(l.id) = 0 THEN true
               WHEN COUNT(l.id) > 0 AND
                    (COUNT(l.id) FILTER (WHERE l.supervisor_verified = true))::numeric
                    / COUNT(l.id) < 0.5 THEN true
               ELSE false
             END AS is_ghost
           FROM app.industrial_training it
           JOIN app.students s ON s.id = it.student_id
           JOIN app.terms t ON t.id = $1
           LEFT JOIN app.it_log_entries l ON l.it_assignment_id = it.id
           WHERE it.status IN ('active', 'completed')
             AND (it.start_date IS NULL OR it.start_date <= t.end_date)
             AND (it.end_date IS NULL OR it.end_date >= t.start_date)
           GROUP BY it.id, s.first_name, s.last_name
           ORDER BY is_ghost DESC, student_name ASC`,
          [term_id],
        );
        return data;
      });

      return rows;
    },
  );
}

