import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
import type { WorkflowDefinition } from "../config/config.schema.js";
import {
  CreateSubmissionSchema,
  PutEntriesSchema,
  SubmissionsQuerySchema,
} from "./marks.schema.js";

// ------------------------------------------------------------------ constants

const PUBLISHED_STATE = "PUBLISHED";
const ENTITY_TYPE = "marks";
const WORKFLOW_KEY = "marks";

const SUBMISSION_SELECT = `
  s.id, s.tenant_id, s.course_id, s.programme, s.intake, s.term,
  s.created_by, s.created_at, s.correction_of_submission_id,
  wi.current_state
`;

// ------------------------------------------------------------------ routes

export async function marksRoutes(app: FastifyInstance) {
  // ---------- POST /marks/submissions
  app.post(
    "/marks/submissions",
    { preHandler: requireRole("instructor", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateSubmissionSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        course_id,
        programme,
        intake,
        term,
        correction_of_submission_id,
      } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        const wf = await loadWorkflowDef(tid, WORKFLOW_KEY, client);
        if (!wf) {
          return {
            configError: true,
            message: `workflow "${WORKFLOW_KEY}" not found in published config`,
          } as const;
        }

        const { rows: subRows } = await client.query(
          `INSERT INTO app.mark_submissions
             (tenant_id, course_id, programme, intake, term, created_by, correction_of_submission_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            tid,
            course_id,
            programme,
            intake,
            term,
            actorUserId,
            correction_of_submission_id ?? null,
          ],
        );
        const submission = subRows[0];

        // Init workflow instance
        await client.query(
          `INSERT INTO app.workflow_instances
             (tenant_id, entity_type, entity_id, workflow_key, current_state)
           VALUES ($1, $2, $3, $4, $5)`,
          [tid, ENTITY_TYPE, submission.id, WORKFLOW_KEY, wf.initial_state],
        );

        // Write init event
        await client.query(
          `INSERT INTO app.workflow_events
             (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
           VALUES ($1, $2, $3, $4, NULL, $5, '__init__', $6)`,
          [
            tid,
            ENTITY_TYPE,
            submission.id,
            WORKFLOW_KEY,
            wf.initial_state,
            actorUserId,
          ],
        );

        return { submission, workflowState: wf.initial_state };
      });

      if ("configError" in result)
        return reply.status(422).send({ error: result.message });

      return reply.status(201).send(result);
    },
  );

  // ---------- PUT /marks/submissions/:id/entries
  app.put<{ Params: { id: string } }>(
    "/marks/submissions/:id/entries",
    { preHandler: requireRole("instructor", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = PutEntriesSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { entries } = parsed.data;
      const { id } = req.params;
      const actorUserId = req.user?.userId ?? null;

      const result = await withTenant(tid, async (client) => {
        // Check submission exists + get workflow state
        const { rows: subRows } = await client.query(
          `SELECT s.id, wi.current_state
           FROM app.mark_submissions s
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = $2 AND wi.entity_id = s.id
           WHERE s.id = $1`,
          [id, ENTITY_TYPE],
        );
        const submission = subRows[0];
        if (!submission) return { notFound: true } as const;
        if (submission.current_state === PUBLISHED_STATE)
          return { published: true } as const;

        const updatedEntries: object[] = [];

        for (const { student_id, score } of entries) {
          // Read existing entry for audit log (old_score)
          const { rows: existing } = await client.query<{
            id: string;
            score: string;
          }>(
            `SELECT id, score FROM app.mark_entries
             WHERE submission_id = $1 AND student_id = $2`,
            [id, student_id],
          );
          const oldScore =
            existing[0] != null ? Number(existing[0].score) : null;

          // Upsert entry
          const { rows: upserted } = await client.query(
            `INSERT INTO app.mark_entries
               (tenant_id, submission_id, student_id, score, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())
             ON CONFLICT (submission_id, student_id)
             DO UPDATE SET score = EXCLUDED.score,
                           updated_by = EXCLUDED.updated_by,
                           updated_at = now()
             RETURNING *`,
            [tid, id, student_id, score, actorUserId],
          );
          const entry = upserted[0];

          // Append audit log row (always, even for new entries)
          await client.query(
            `INSERT INTO app.mark_audit_log
               (tenant_id, submission_id, entry_id, old_score, new_score, actor_user_id, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())`,
            [tid, id, entry.id, oldScore, score, actorUserId],
          );

          updatedEntries.push(entry);
        }

        return { entries: updatedEntries };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "submission not found" });
      if ("published" in result)
        return reply
          .status(409)
          .send({ error: "PUBLISHED submissions are immutable" });

      return reply.status(200).send(result);
    },
  );

  // ---------- GET /marks/submissions
  app.get(
    "/marks/submissions",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = SubmissionsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { course_id, programme, intake, term, current_state, page, limit } =
        parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (course_id) {
          params.push(course_id);
          conditions.push(`s.course_id = $${params.length}`);
        }
        if (programme) {
          params.push(programme);
          conditions.push(`s.programme = $${params.length}`);
        }
        if (intake) {
          params.push(intake);
          conditions.push(`s.intake = $${params.length}`);
        }
        if (term) {
          params.push(term);
          conditions.push(`s.term = $${params.length}`);
        }
        if (current_state) {
          params.push(current_state);
          conditions.push(`wi.current_state = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        const limitIdx = params.length - 1;
        const offsetIdx = params.length;

        return client.query(
          `SELECT ${SUBMISSION_SELECT}
         FROM app.mark_submissions s
         LEFT JOIN app.workflow_instances wi
           ON wi.entity_type = '${ENTITY_TYPE}' AND wi.entity_id = s.id
         WHERE s.tenant_id = $1 ${where}
         ORDER BY s.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // ---------- GET /marks/submissions/:id
  app.get<{ Params: { id: string } }>(
    "/marks/submissions/:id",
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const row = await withTenant(tid, async (client) => {
        const { rows: subRows } = await client.query(
          `SELECT ${SUBMISSION_SELECT}
           FROM app.mark_submissions s
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = '${ENTITY_TYPE}' AND wi.entity_id = s.id
           WHERE s.id = $1`,
          [id],
        );
        const submission = subRows[0];
        if (!submission) return null;

        const { rows: entries } = await client.query(
          `SELECT * FROM app.mark_entries
           WHERE submission_id = $1
           ORDER BY updated_at`,
          [id],
        );

        return { ...submission, entries };
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // ---------- GET /marks/submissions/:id/audit  (SR-F-022)
  app.get<{ Params: { id: string } }>(
    "/marks/submissions/:id/audit",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const rows = await withTenant(tid, async (client) => {
        // Verify submission belongs to this tenant
        const { rows: check } = await client.query(
          `SELECT id FROM app.mark_submissions WHERE id = $1`,
          [id],
        );
        if (check.length === 0) return null;

        const { rows: audit } = await client.query(
          `SELECT
             al.id, al.entry_id, al.old_score, al.new_score,
             al.actor_user_id, al.changed_at,
             me.student_id
           FROM app.mark_audit_log al
           LEFT JOIN app.mark_entries me ON me.id = al.entry_id
           WHERE al.submission_id = $1
           ORDER BY al.changed_at DESC`,
          [id],
        );
        return audit;
      });

      if (rows === null) return reply.status(404).send({ error: "not found" });
      return rows;
    },
  );
}

