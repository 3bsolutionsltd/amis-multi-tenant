import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
import type { WorkflowDefinition } from "../config/config.schema.js";
import {
  ASSESSMENT_TYPES,
  CreateSubmissionSchema,
  PutEntriesSchema,
  SubmissionsQuerySchema,
  UpdateSubmissionSchema,
} from "./marks.schema.js";

// ------------------------------------------------------------------ constants

const PUBLISHED_STATE = "PUBLISHED";
const DRAFT_STATE = "DRAFT";
const ENTITY_TYPE = "marks";
const WORKFLOW_KEY = "marks";

const SUBMISSION_SELECT = `
  s.id, s.tenant_id, s.course_id, s.programme, s.intake, s.term,
  s.assessment_type, s.weight, s.assessment_date,
  s.created_by, s.created_at, s.correction_of_submission_id,
  wi.current_state, c.title AS course_title
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
        assessment_type,
        weight,
        assessment_date,
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

        // Validate assessment_type against tenant config or hardcoded fallback
        const { rows: cfgRows } = await client.query<{
          payload: { assessment_types?: string[] };
        }>(
          `SELECT payload FROM platform.config_versions
           WHERE tenant_id = $1 AND status = 'published'
           LIMIT 1`,
          [tid],
        );
        const cfgPayload = cfgRows[0]?.payload;
        const validTypes: string[] =
          cfgPayload?.assessment_types && cfgPayload.assessment_types.length > 0
            ? cfgPayload.assessment_types
            : [...ASSESSMENT_TYPES];
        if (!validTypes.includes(assessment_type)) {
          return {
            invalidAssessmentType: true,
            message: `assessment_type "${assessment_type}" is not valid for this tenant. Valid types: ${validTypes.join(", ")}`,
          } as const;
        }

        const { rows: subRows } = await client.query(
          `INSERT INTO app.mark_submissions
             (tenant_id, course_id, programme, intake, term, assessment_type, weight, assessment_date, created_by, correction_of_submission_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            tid,
            course_id,
            programme,
            intake,
            term,
            assessment_type ?? "end_of_term",
            weight ?? null,
            assessment_date ?? null,
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
      if ("invalidAssessmentType" in result)
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
        // Check submission exists + get workflow state and term context
        const { rows: subRows } = await client.query(
          `SELECT s.id, s.programme, s.intake, s.term, wi.current_state
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

        // Resolve the term label to check registrations
        // mark_submissions.term is the same text label used in term_registrations
        const submissionTerm: string | null = submission.term ?? null;

        const updatedEntries: object[] = [];
        const enrollmentErrors: string[] = [];

        for (const { student_id, score } of entries) {
          // Enrolment verification (#90): student must have a term_registration
          // for the same term as the submission. Warn but don't hard-block so
          // corrections can still be entered (configurable in future).
          if (submissionTerm) {
            const { rows: regRows } = await client.query<{ id: string }>(
              `SELECT id FROM app.term_registrations
               WHERE student_id = $1 AND term = $2`,
              [student_id, submissionTerm],
            );
            if (regRows.length === 0) {
              enrollmentErrors.push(student_id);
            }
          }

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

        return { entries: updatedEntries, unenrolledStudents: enrollmentErrors };
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

  // ---------- PATCH /marks/submissions/:id  (issue #296 — edit while DRAFT)
  app.patch<{ Params: { id: string } }>(
    "/marks/submissions/:id",
    { preHandler: requireRole("instructor", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateSubmissionSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const updates = parsed.data;

      const result = await withTenant(tid, async (client) => {
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
        if (submission.current_state !== DRAFT_STATE)
          return { notDraft: true } as const;

        const fields: string[] = [];
        const params: unknown[] = [];
        const addField = (col: string, val: unknown) => {
          if (val !== undefined) {
            params.push(val);
            fields.push(`${col} = $${params.length}`);
          }
        };
        addField("course_id", updates.course_id);
        addField("programme", updates.programme);
        addField("intake", updates.intake);
        addField("term", updates.term);
        addField("assessment_type", updates.assessment_type);
        addField("weight", updates.weight);
        addField("assessment_date", updates.assessment_date);

        params.push(id);
        const { rows } = await client.query(
          `UPDATE app.mark_submissions SET ${fields.join(", ")}
           WHERE id = $${params.length}
           RETURNING *`,
          params,
        );
        return { submission: { ...rows[0], current_state: submission.current_state } } as const;
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "submission not found" });
      if ("notDraft" in result)
        return reply
          .status(409)
          .send({ error: "only DRAFT submissions can be edited" });

      return reply.status(200).send(result.submission);
    },
  );

  // ---------- DELETE /marks/submissions/:id  (issue #296 — delete while DRAFT)
  app.delete<{ Params: { id: string } }>(
    "/marks/submissions/:id",
    { preHandler: requireRole("instructor", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params;

      const result = await withTenant(tid, async (client) => {
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
        if (submission.current_state !== DRAFT_STATE)
          return { notDraft: true } as const;

        // Other submissions may reference this one as a correction — deleting
        // it would violate the FK on correction_of_submission_id (500 in prod).
        const { rows: referencing } = await client.query(
          `SELECT id FROM app.mark_submissions WHERE correction_of_submission_id = $1 LIMIT 1`,
          [id],
        );
        if (referencing.length > 0) return { referencedByCorrection: true } as const;

        await client.query(`DELETE FROM app.mark_entries WHERE submission_id = $1`, [id]);
        await client.query(`DELETE FROM app.mark_audit_log WHERE submission_id = $1`, [id]);
        // app.workflow_events is append-only (BEFORE DELETE trigger raises),
        // so its history for this entity is intentionally left in place.
        await client.query(
          `DELETE FROM app.workflow_instances WHERE entity_type = $2 AND entity_id = $1`,
          [id, ENTITY_TYPE],
        );
        await client.query(`DELETE FROM app.mark_submissions WHERE id = $1`, [id]);
        return { deleted: true } as const;
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "submission not found" });
      if ("notDraft" in result)
        return reply
          .status(409)
          .send({ error: "only DRAFT submissions can be deleted" });
      if ("referencedByCorrection" in result)
        return reply.status(409).send({
          error:
            "cannot delete: another submission is recorded as a correction of this one",
        });

      return reply.status(204).send();
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

      const { course_id, programme, intake, term, assessment_type, current_state, page, limit } =
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
        if (assessment_type) {
          params.push(assessment_type);
          conditions.push(`s.assessment_type = $${params.length}`);
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
         LEFT JOIN app.courses c
           ON c.tenant_id = s.tenant_id AND c.code = s.course_id
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
           LEFT JOIN app.courses c
             ON c.tenant_id = s.tenant_id AND c.code = s.course_id
           WHERE s.id = $1`,
          [id],
        );
        const submission = subRows[0];
        if (!submission) return null;

        const { rows: entries } = await client.query(
          `SELECT me.id, me.student_id, me.score, me.updated_by, me.updated_at,
                  me.evidence_files,
                  s.first_name, s.last_name
           FROM app.mark_entries me
           LEFT JOIN app.students s ON s.id = me.student_id
           WHERE me.submission_id = $1
           ORDER BY me.updated_at`,
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
             me.student_id,
             s.first_name AS student_first_name, s.last_name AS student_last_name,
             s.admission_number AS student_admission_number,
             u.first_name AS actor_first_name, u.last_name AS actor_last_name,
             u.email AS actor_email
           FROM app.mark_audit_log al
           LEFT JOIN app.mark_entries me ON me.id = al.entry_id
           LEFT JOIN app.students s ON s.id = me.student_id
           LEFT JOIN platform.users u ON u.id = al.actor_user_id
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

  // ==========================================================================
  // EVIDENCE ATTACHMENTS
  // ==========================================================================

  // PATCH /marks/entries/:entryId/evidence — append file refs to evidence_files
  app.patch<{ Params: { entryId: string } }>(
    "/marks/entries/:entryId/evidence",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const body = req.body as { files?: unknown[] };
      if (!Array.isArray(body?.files) || body.files.length === 0) {
        return reply.status(422).send({ error: "files array is required" });
      }

      const { entryId } = req.params;
      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `UPDATE app.mark_entries
           SET evidence_files = evidence_files || $1::jsonb,
               updated_at = now()
           WHERE id = $2
           RETURNING id, evidence_files`,
          [JSON.stringify(body.files), entryId],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "Mark entry not found" });
      return row;
    },
  );

  // DELETE /marks/entries/:entryId/evidence — remove one file ref by URL
  app.delete<{ Params: { entryId: string } }>(
    "/marks/entries/:entryId/evidence",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid) return reply.status(400).send({ error: "x-tenant-id header required" });

      const body = req.body as { url?: string };
      if (!body?.url) return reply.status(422).send({ error: "url is required" });

      const { entryId } = req.params;
      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `UPDATE app.mark_entries
           SET evidence_files = (
             SELECT jsonb_agg(f)
             FROM jsonb_array_elements(evidence_files) AS f
             WHERE f->>'url' <> $1
           ),
               updated_at = now()
           WHERE id = $2
           RETURNING id, evidence_files`,
          [body.url, entryId],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "Mark entry not found" });
      return row;
    },
  );
}

