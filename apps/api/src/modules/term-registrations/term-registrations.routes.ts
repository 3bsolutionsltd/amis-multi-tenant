import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
import type { WorkflowDefinition } from "../config/config.schema.js";
import {
  CreateTermRegistrationSchema,
  BulkTermRegistrationSchema,
  PromoteTermRegistrationSchema,
  TermRegistrationsQuerySchema,
} from "./term-registrations.schema.js";

// ------------------------------------------------------------------ constants

const ENTITY_TYPE = "term_registration";
const WORKFLOW_KEY = "term_registration";

const REG_SELECT = `
  r.id, r.tenant_id, r.student_id, r.academic_year, r.term,
  r.academic_year_id, r.term_id,
  r.extension, r.created_by, r.created_at, r.updated_at,
  s.first_name, s.last_name, s.admission_number, s.programme AS student_programme,
  wi.current_state
`;

// ------------------------------------------------------------------ routes

export async function termRegistrationsRoutes(app: FastifyInstance) {
  // ---------- POST /term-registrations
  app.post(
    "/term-registrations",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateTermRegistrationSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, academic_year, term, extension } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        const wf = await loadWorkflowDef(tid, WORKFLOW_KEY, client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "${WORKFLOW_KEY}" not found in published config`,
          } as const;
        }

        // Verify student belongs to this tenant
        const { rows: stuRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.students WHERE id = $1`,
          [student_id],
        );
        if (!stuRows[0]) {
          return { notFound: true, message: "student not found" } as const;
        }

        // Resolve FK references from text labels
        const { rows: ayRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, academic_year],
        );
        const { rows: tRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.terms WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, term],
        );

        // Insert registration
        const { rows: regRows } = await client.query(
          `INSERT INTO app.term_registrations
             (tenant_id, student_id, academic_year, term, academic_year_id, term_id, extension, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            tid,
            student_id,
            academic_year,
            term,
            ayRows[0]?.id ?? null,
            tRows[0]?.id ?? null,
            JSON.stringify(extension ?? {}),
            actorUserId,
          ],
        );
        const registration = regRows[0];

        // Init workflow instance
        await client.query(
          `INSERT INTO app.workflow_instances
             (tenant_id, entity_type, entity_id, workflow_key, current_state)
           VALUES ($1, $2, $3, $4, $5)`,
          [tid, ENTITY_TYPE, registration.id, WORKFLOW_KEY, wf.initial_state],
        );

        // Write init event
        await client.query(
          `INSERT INTO app.workflow_events
             (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
           VALUES ($1, $2, $3, $4, NULL, $5, '__init__', $6)`,
          [
            tid,
            ENTITY_TYPE,
            registration.id,
            WORKFLOW_KEY,
            wf.initial_state,
            actorUserId,
          ],
        );

        return { registration, workflowState: wf.initial_state };
      });

      if ("configError" in result)
        return reply.status(422).send({ error: result.message });
      if ("notFound" in result)
        return reply.status(404).send({ error: result.message });

      return reply.status(201).send(result);
    },
  );

  // ---------- GET /term-registrations
  app.get(
    "/term-registrations",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "principal",
        "dean",
        "finance",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = TermRegistrationsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, academic_year, term, academic_year_id, term_id, current_state, page, limit } =
        parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (student_id) {
          params.push(student_id);
          conditions.push(`r.student_id = $${params.length}`);
        }
        if (academic_year_id) {
          params.push(academic_year_id);
          conditions.push(`r.academic_year_id = $${params.length}`);
        } else if (academic_year) {
          params.push(academic_year);
          conditions.push(`r.academic_year = $${params.length}`);
        }
        if (term_id) {
          params.push(term_id);
          conditions.push(`r.term_id = $${params.length}`);
        } else if (term) {
          params.push(term);
          conditions.push(`r.term = $${params.length}`);
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
          `SELECT ${REG_SELECT}
           FROM app.term_registrations r
           LEFT JOIN app.students s ON s.id = r.student_id
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = '${ENTITY_TYPE}' AND wi.entity_id = r.id
           WHERE r.tenant_id = $1 ${where}
           ORDER BY r.created_at DESC
           LIMIT $${limitParam} OFFSET $${offsetParam}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // ---------- GET /term-registrations/:id
  app.get<{ Params: { id: string } }>(
    "/term-registrations/:id",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "principal",
        "dean",
        "finance",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT ${REG_SELECT}
           FROM app.term_registrations r
           LEFT JOIN app.students s ON s.id = r.student_id
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = '${ENTITY_TYPE}' AND wi.entity_id = r.id
           WHERE r.id = $1`,
          [id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // ---------- GET /term-registrations/:id/doc-checks (#199)
  app.get<{ Params: { id: string } }>(
    "/term-registrations/:id/doc-checks",
    {
      preHandler: requireRole(
        "admin", "registrar", "hod", "principal", "dean", "finance", "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const DEFAULT_DOCS = [
        "National ID / Birth Certificate",
        "Academic Certificates",
        "Passport Photos",
        "Medical Certificate",
        "Recommendation Letter",
        "Fee Payment Receipt",
      ];

      const rows = await withTenant(tid, async (client) => {
        const { rows: regRows } = await client.query(
          `SELECT id FROM app.term_registrations WHERE id = $1`,
          [id],
        );
        if (!regRows[0]) return null;

        const { rows: checks } = await client.query(
          `SELECT id, doc_name, status, remarks, reviewed_by, reviewed_at, created_at
           FROM app.term_registration_doc_checks
           WHERE tenant_id = $1 AND registration_id = $2
           ORDER BY created_at ASC`,
          [tid, id],
        );

        // Seed default docs that haven't been added yet
        const existing = new Set(checks.map((c: { doc_name: string }) => c.doc_name));
        const toSeed = DEFAULT_DOCS.filter((d) => !existing.has(d));
        if (toSeed.length > 0) {
          for (const doc_name of toSeed) {
            await client.query(
              `INSERT INTO app.term_registration_doc_checks
                 (tenant_id, registration_id, doc_name, status)
               VALUES ($1, $2, $3, 'PENDING')
               ON CONFLICT (tenant_id, registration_id, doc_name) DO NOTHING`,
              [tid, id, doc_name],
            );
          }
          const { rows: seeded } = await client.query(
            `SELECT id, doc_name, status, remarks, reviewed_by, reviewed_at, created_at
             FROM app.term_registration_doc_checks
             WHERE tenant_id = $1 AND registration_id = $2
             ORDER BY created_at ASC`,
            [tid, id],
          );
          return seeded;
        }
        return checks;
      });

      if (rows === null)
        return reply.status(404).send({ error: "registration not found" });
      return rows;
    },
  );

  // ---------- PUT /term-registrations/:id/doc-checks/:docName (#199)
  app.put<{ Params: { id: string; docName: string } }>(
    "/term-registrations/:id/doc-checks/:docName",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id, docName } = req.params;
      const actorUserId = req.user?.userId ?? null;
      const body = req.body as { status?: string; remarks?: string };
      const status = body?.status;
      const remarks = body?.remarks ?? null;

      const VALID_STATUSES = ["ACCEPTED", "REJECTED", "WAIVED", "PENDING"];
      if (!status || !VALID_STATUSES.includes(status)) {
        return reply.status(422).send({
          error: "status must be ACCEPTED, REJECTED, WAIVED, or PENDING",
        });
      }

      const row = await withTenant(tid, async (client) => {
        // Ensure registration belongs to this tenant
        const { rows: regRows } = await client.query(
          `SELECT id FROM app.term_registrations WHERE id = $1`,
          [id],
        );
        if (!regRows[0]) return null;

        const { rows } = await client.query(
          `INSERT INTO app.term_registration_doc_checks
             (tenant_id, registration_id, doc_name, status, remarks, reviewed_by, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (tenant_id, registration_id, doc_name) DO UPDATE
             SET status      = EXCLUDED.status,
                 remarks     = EXCLUDED.remarks,
                 reviewed_by = EXCLUDED.reviewed_by,
                 reviewed_at = EXCLUDED.reviewed_at
           RETURNING *`,
          [tid, id, docName, status, remarks, actorUserId],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "registration not found" });
      return row;
    },
  );

  // ---------- POST /term-registrations/bulk — register multiple students at once (#59)
  app.post(
    "/term-registrations/bulk",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = BulkTermRegistrationSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year, term, student_ids } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        const wf = await loadWorkflowDef(tid, WORKFLOW_KEY, client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "${WORKFLOW_KEY}" not found in published config`,
          } as const;
        }

        // Resolve FK IDs once for all students in the batch
        const { rows: ayRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, academic_year],
        );
        const { rows: tRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.terms WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, term],
        );
        const academicYearId = ayRows[0]?.id ?? null;
        const termFkId = tRows[0]?.id ?? null;

        let created = 0;
        let skipped = 0;
        const errors: { student_id: string; error: string }[] = [];

        for (const student_id of student_ids) {
          // Check student exists
          const { rows: stuRows } = await client.query<{ id: string }>(
            `SELECT id FROM app.students WHERE id = $1 AND is_active = true`,
            [student_id],
          );
          if (!stuRows[0]) {
            errors.push({ student_id, error: "student not found or inactive" });
            continue;
          }

          // Skip if already registered for this term
          const { rows: existing } = await client.query(
            `SELECT id FROM app.term_registrations
             WHERE student_id = $1 AND academic_year = $2 AND term = $3`,
            [student_id, academic_year, term],
          );
          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Insert registration
          const { rows: regRows } = await client.query(
            `INSERT INTO app.term_registrations
               (tenant_id, student_id, academic_year, term, academic_year_id, term_id, extension, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, '{}', $7)
             ON CONFLICT (tenant_id, student_id, academic_year, term) DO NOTHING
             RETURNING id`,
            [tid, student_id, academic_year, term, academicYearId, termFkId, actorUserId],
          );
          const regId = regRows[0]?.id;
          if (!regId) {
            skipped++;
            continue;
          }

          // Init workflow
          await client.query(
            `INSERT INTO app.workflow_instances
               (tenant_id, entity_type, entity_id, workflow_key, current_state)
             VALUES ($1, $2, $3, $4, $5)`,
            [tid, ENTITY_TYPE, regId, WORKFLOW_KEY, wf.initial_state],
          );

          await client.query(
            `INSERT INTO app.workflow_events
               (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
             VALUES ($1, $2, $3, $4, NULL, $5, '__init__', $6)`,
            [tid, ENTITY_TYPE, regId, WORKFLOW_KEY, wf.initial_state, actorUserId],
          );

          created++;
        }

        return { created, skipped, errors };
      });

      if ("configError" in result)
        return reply.status(422).send({ error: result.message });

      return reply.status(201).send(result);
    },
  );

  // ---------- POST /term-registrations/promote — auto-register all active students (#59)
  app.post(
    "/term-registrations/promote",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = PromoteTermRegistrationSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year, term } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        const wf = await loadWorkflowDef(tid, WORKFLOW_KEY, client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "${WORKFLOW_KEY}" not found in published config`,
          } as const;
        }

        // Find all active students not yet registered for this term
        const { rows: students } = await client.query<{ id: string }>(
          `SELECT s.id FROM app.students s
           WHERE s.is_active = true
             AND NOT EXISTS (
               SELECT 1 FROM app.term_registrations tr
               WHERE tr.student_id = s.id AND tr.academic_year = $1 AND tr.term = $2
             )`,
          [academic_year, term],
        );

        // Resolve FK IDs once for all students in the batch
        const { rows: promoteAyRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, academic_year],
        );
        const { rows: promoteTRows } = await client.query<{ id: string }>(
          `SELECT id FROM app.terms WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tid, term],
        );
        const promoteAcademicYearId = promoteAyRows[0]?.id ?? null;
        const promoteTermId = promoteTRows[0]?.id ?? null;

        let created = 0;
        for (const { id: student_id } of students) {
          const { rows: regRows } = await client.query(
            `INSERT INTO app.term_registrations
               (tenant_id, student_id, academic_year, term, academic_year_id, term_id, extension, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, '{}', $7)
             ON CONFLICT (tenant_id, student_id, academic_year, term) DO NOTHING
             RETURNING id`,
            [tid, student_id, academic_year, term, promoteAcademicYearId, promoteTermId, actorUserId],
          );
          const regId = regRows[0]?.id;
          if (!regId) continue;

          await client.query(
            `INSERT INTO app.workflow_instances
               (tenant_id, entity_type, entity_id, workflow_key, current_state)
             VALUES ($1, $2, $3, $4, $5)`,
            [tid, ENTITY_TYPE, regId, WORKFLOW_KEY, wf.initial_state],
          );

          await client.query(
            `INSERT INTO app.workflow_events
               (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
             VALUES ($1, $2, $3, $4, NULL, $5, '__init__', $6)`,
            [tid, ENTITY_TYPE, regId, WORKFLOW_KEY, wf.initial_state, actorUserId],
          );

          created++;
        }

        return { created, total_active_students: students.length };
      });

      if ("configError" in result)
        return reply.status(422).send({ error: result.message });

      return reply.status(201).send(result);
    },
  );
}

