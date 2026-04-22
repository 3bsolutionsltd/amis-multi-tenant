import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { sendSms, buildAdmissionEnrolledSms } from "../../lib/sms.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
import type { WorkflowDefinition } from "../config/config.schema.js";
import {
  CreateApplicationSchema,
  ApplicationsQuerySchema,
} from "./admissions.schema.js";

// ------------------------------------------------------------------ helpers

const APP_SELECT = `
  a.id, a.tenant_id, a.first_name, a.last_name, a.programme, a.intake,
  a.dob, a.gender, a.email, a.phone, a.sponsorship_type, a.student_id, a.extension, a.created_at,
  wi.current_state
`;

// ------------------------------------------------------------------ routes

export async function admissionsRoutes(app: FastifyInstance) {
  // ---------- POST /admissions/applications
  app.post(
    "/admissions/applications",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = req.user?.tenantId ?? tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateApplicationSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        first_name,
        last_name,
        programme,
        intake,
        dob,
        gender,
        email,
        phone,
        sponsorship_type,
        extension,
      } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        // Load workflow definition
        const wf = await loadWorkflowDef(tid, "admissions", client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "admissions" not found in published config`,
          } as const;
        }

        // Insert application
        const { rows: appRows } = await client.query(
          `INSERT INTO app.admission_applications
             (tenant_id, first_name, last_name, programme, intake, dob, gender, email, phone, sponsorship_type, extension)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            tid,
            first_name,
            last_name,
            programme,
            intake,
            dob ?? null,
            gender ?? null,
            email ?? null,
            phone ?? null,
            sponsorship_type ?? null,
            JSON.stringify(extension ?? {}),
          ],
        );
        const application = appRows[0];

        // Init workflow instance
        await client.query(
          `INSERT INTO app.workflow_instances
             (tenant_id, entity_type, entity_id, workflow_key, current_state)
           VALUES ($1, 'admissions', $2, 'admissions', $3)`,
          [tid, application.id, wf.initial_state],
        );

        // Write init event
        await client.query(
          `INSERT INTO app.workflow_events
             (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
           VALUES ($1, 'admissions', $2, 'admissions', NULL, $3, '__init__', $4)`,
          [tid, application.id, wf.initial_state, actorUserId],
        );

        return { application, workflowState: wf.initial_state };
      });

      if ("configError" in result)
        return reply.status(422).send({ error: result.message });

      return reply.status(201).send(result);
    },
  );

  // ---------- GET /admissions/applications
  app.get(
    "/admissions/applications",
    {
      preHandler: requireRole("admin", "registrar", "hod", "principal", "dean"),
    },
    async (req, reply) => {
      const tid = req.user?.tenantId ?? tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ApplicationsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { search, intake, programme, current_state, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(a.first_name ILIKE $${params.length} OR a.last_name ILIKE $${params.length} OR a.email ILIKE $${params.length})`,
          );
        }
        if (intake) {
          params.push(intake);
          conditions.push(`a.intake = $${params.length}`);
        }
        if (programme) {
          params.push(programme);
          conditions.push(`a.programme = $${params.length}`);
        }
        if (current_state) {
          params.push(current_state);
          conditions.push(`wi.current_state = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        const limitParam = params.length - 1;
        const offsetParam = params.length;

        return client.query(
          `SELECT ${APP_SELECT}
         FROM app.admission_applications a
         LEFT JOIN app.workflow_instances wi
           ON wi.entity_type = 'admissions' AND wi.entity_id = a.id
         WHERE a.tenant_id = $1 ${where}
         ORDER BY a.created_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // ---------- GET /admissions/applications/:id
  app.get<{ Params: { id: string } }>(
    "/admissions/applications/:id",
    {
      preHandler: requireRole("admin", "registrar", "hod", "principal", "dean"),
    },
    async (req, reply) => {
      const tid = req.user?.tenantId ?? tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT ${APP_SELECT}
           FROM app.admission_applications a
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'admissions' AND wi.entity_id = a.id
           WHERE a.id = $1`,
          [id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // ---------- POST /admissions/import
  app.post(
    "/admissions/import",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = req.user?.tenantId ?? tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const body = req.body as { filename?: string; rows?: unknown[] };
      const filename = body?.filename ?? "import.csv";
      const rawRows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];

      const valid: object[] = [];
      const invalid: { row: unknown; errors: unknown }[] = [];

      for (const row of rawRows) {
        const parsed = CreateApplicationSchema.safeParse(row);
        if (parsed.success) {
          valid.push(parsed.data);
        } else {
          invalid.push({ row, errors: parsed.error.flatten() });
        }
      }

      const actorUserId = req.user?.userId ?? null;

      // Create a preview batch — does NOT insert applications
      const batch = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.admission_import_batches
             (tenant_id, filename, status, row_count, imported_by, meta)
           VALUES ($1, $2, 'preview', $3, $4, $5)
           RETURNING *`,
          [
            tid,
            filename,
            valid.length,
            actorUserId,
            JSON.stringify({ valid, invalid }),
          ],
        );
        return rows[0];
      });

      return reply.status(200).send({
        batchId: batch.id,
        valid,
        invalid,
        total: rawRows.length,
      });
    },
  );

  // ---------- POST /admissions/import/:batchId/confirm
  app.post<{ Params: { batchId: string } }>(
    "/admissions/import/:batchId/confirm",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = req.user?.tenantId ?? tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { batchId } = req.params;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        // Load batch
        const { rows: batchRows } = await client.query(
          `SELECT * FROM app.admission_import_batches WHERE id = $1`,
          [batchId],
        );
        const batch = batchRows[0];
        if (!batch) return { notFound: true } as const;

        const meta = batch.meta as {
          valid: object[];
          invalid: unknown[];
        };
        const validRows = Array.isArray(meta?.valid) ? meta.valid : [];

        if (validRows.length === 0) {
          return { imported: 0, skipped: 0 };
        }

        // Load workflow definition
        const wf = await loadWorkflowDef(tid, "admissions", client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "admissions" not found in published config`,
          } as const;
        }

        let imported = 0;
        let skipped = 0;

        for (const rawRow of validRows) {
          const parsed = CreateApplicationSchema.safeParse(rawRow);
          if (!parsed.success) {
            skipped++;
            continue;
          }

          const {
            first_name,
            last_name,
            programme,
            intake,
            dob,
            gender,
            extension,
          } = parsed.data;

          const { rows: appRows } = await client.query(
            `INSERT INTO app.admission_applications
               (tenant_id, first_name, last_name, programme, intake, dob, gender, extension)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              tid,
              first_name,
              last_name,
              programme,
              intake,
              dob ?? null,
              gender ?? null,
              JSON.stringify(extension ?? {}),
            ],
          );
          const appId = appRows[0].id;

          await client.query(
            `INSERT INTO app.workflow_instances
               (tenant_id, entity_type, entity_id, workflow_key, current_state)
             VALUES ($1, 'admissions', $2, 'admissions', $3)`,
            [tid, appId, wf.initial_state],
          );

          await client.query(
            `INSERT INTO app.workflow_events
               (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
             VALUES ($1, 'admissions', $2, 'admissions', NULL, $3, '__init__', $4)`,
            [tid, appId, wf.initial_state, actorUserId],
          );

          imported++;
        }

        // Update batch to confirmed
        await client.query(
          `UPDATE app.admission_import_batches
           SET status = 'confirmed', row_count = $1
           WHERE id = $2`,
          [imported, batchId],
        );

        return { imported, skipped };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "batch not found" });
      if ("configError" in result)
        return reply.status(422).send({ error: result.message });

      return reply.status(200).send(result);
    },
  );

  // ---------- POST /admissions/applications/:id/enroll
  app.post<{ Params: { id: string } }>(
    "/admissions/applications/:id/enroll",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const result = await withTenant(tid, async (client) => {
        // Load application with workflow state
        const { rows: appRows } = await client.query(
          `SELECT ${APP_SELECT}
           FROM app.admission_applications a
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'admissions' AND wi.entity_id = a.id
           WHERE a.id = $1`,
          [id],
        );
        const application = appRows[0];
        if (!application) return { notFound: true } as const;

        // Already enrolled?
        if (application.student_id) {
          return { alreadyEnrolled: true, studentId: application.student_id } as const;
        }

        // Check workflow state allows enrollment
        const state = application.current_state;
        if (state !== "enrolled" && state !== "admitted") {
          return {
            invalidState: true,
            message: `Cannot enroll: application is in "${state}" state`,
          } as const;
        }

        // Generate admission number: ADM-<year>-<seq>
        const year = new Date().getFullYear();
        const { rows: seqRows } = await client.query(
          `SELECT COUNT(*)::int + 1 AS seq
           FROM app.students WHERE admission_number LIKE $1`,
          [`ADM-${year}-%`],
        );
        const seq = String(seqRows[0].seq).padStart(4, "0");
        const admissionNumber = `ADM-${year}-${seq}`;

        // Create student from application data
        const { rows: stuRows } = await client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name, date_of_birth, admission_number,
              sponsorship_type, programme, email, phone, extension)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            tid,
            application.first_name,
            application.last_name,
            application.dob ?? null,
            admissionNumber,
            application.sponsorship_type ?? null,
            application.programme ?? null,
            application.email ?? null,
            application.phone ?? null,
            JSON.stringify(application.extension ?? {}),
          ],
        );
        const student = stuRows[0];

        // Link application to student
        await client.query(
          `UPDATE app.admission_applications SET student_id = $1 WHERE id = $2`,
          [student.id, id],
        );

        return { student, admissionNumber };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "application not found" });
      if ("alreadyEnrolled" in result)
        return reply
          .status(409)
          .send({ error: "already enrolled", studentId: result.studentId });
      if ("invalidState" in result)
        return reply.status(422).send({ error: result.message });

      // Fire-and-forget SMS to enrolled student's phone
      const enrolledPhone = result.student?.phone ?? null;
      if (enrolledPhone) {
        const msg = buildAdmissionEnrolledSms({
          studentName: `${result.student.first_name} ${result.student.last_name}`,
          admissionNumber: result.admissionNumber,
          programme: result.student.programme ?? null,
        });
        sendSms(enrolledPhone, msg).catch((err) =>
          console.error("[SMS] Enrolment notification failed:", err),
        );
      }

      return reply.status(201).send(result);
    },
  );
}

