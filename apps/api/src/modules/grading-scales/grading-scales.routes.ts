import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateGradingScaleSchema,
  UpdateGradingScaleSchema,
  GradingScalesQuerySchema,
  CreateGradeBoundarySchema,
  UpdateGradeBoundarySchema,
  BulkBoundariesSchema,
} from "./grading-scales.schema.js";

// ------------------------------------------------------------------ constants

const WRITE_ROLES = ["registrar", "admin"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "principal",
  "dean",
] as const;

const SCALE_COLS = "id, tenant_id, name, is_default, created_at, updated_at";
const BOUNDARY_COLS =
  "id, grading_scale_id, grade_letter, description, min_score, max_score, grade_point, created_at";

// ------------------------------------------------------------------ routes

export async function gradingScalesRoutes(app: FastifyInstance) {
  // ======================== Grading Scales ========================

  // GET /grading-scales
  app.get(
    "/grading-scales",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = GradingScalesQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, (client) =>
        client.query(
          `SELECT ${SCALE_COLS} FROM app.grading_scales
           ORDER BY name ASC LIMIT $1 OFFSET $2`,
          [limit, offset],
        ),
      );

      return rows.rows;
    },
  );

  // GET /grading-scales/:id (with boundaries)
  app.get<{ Params: { id: string } }>(
    "/grading-scales/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const result = await withTenant(tid, async (client) => {
        const { rows: scaleRows } = await client.query(
          `SELECT ${SCALE_COLS} FROM app.grading_scales WHERE id = $1`,
          [req.params.id],
        );
        if (scaleRows.length === 0) return null;

        const { rows: boundaries } = await client.query(
          `SELECT ${BOUNDARY_COLS} FROM app.grade_boundaries
           WHERE grading_scale_id = $1
           ORDER BY min_score DESC`,
          [req.params.id],
        );

        return { ...scaleRows[0], boundaries };
      });

      if (!result)
        return reply.status(404).send({ error: "grading scale not found" });

      return result;
    },
  );

  // POST /grading-scales
  app.post(
    "/grading-scales",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateGradingScaleSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { name, is_default } = parsed.data;

      const row = await withTenant(tid, (client) =>
        client.query(
          `INSERT INTO app.grading_scales (tenant_id, name, is_default)
           VALUES ($1, $2, $3)
           RETURNING ${SCALE_COLS}`,
          [tid, name, is_default ?? false],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /grading-scales/:id
  app.patch<{ Params: { id: string } }>(
    "/grading-scales/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateGradingScaleSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const updates = parsed.data;
      if (Object.keys(updates).length === 0)
        return reply.status(422).send({ error: "no fields to update" });

      const fields = Object.keys(updates) as (keyof typeof updates)[];
      const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = fields.map((k) => updates[k]);

      const row = await withTenant(tid, (client) =>
        client.query(
          `UPDATE app.grading_scales
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${SCALE_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "grading scale not found" });

      return row.rows[0];
    },
  );

  // ======================== Grade Boundaries ========================

  // POST /grading-scales/:id/boundaries (bulk set)
  app.post<{ Params: { id: string } }>(
    "/grading-scales/:id/boundaries",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = BulkBoundariesSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const boundaries = parsed.data;

      const result = await withTenant(tid, async (client) => {
        // Verify scale exists
        const { rows: scaleRows } = await client.query(
          `SELECT id FROM app.grading_scales WHERE id = $1`,
          [req.params.id],
        );
        if (scaleRows.length === 0) return null;

        // Replace all boundaries: delete then insert
        await client.query(
          `DELETE FROM app.grade_boundaries WHERE grading_scale_id = $1`,
          [req.params.id],
        );

        const inserted = [];
        for (const b of boundaries) {
          const { rows } = await client.query(
            `INSERT INTO app.grade_boundaries
               (grading_scale_id, grade_letter, description, min_score, max_score, grade_point)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${BOUNDARY_COLS}`,
            [
              req.params.id,
              b.grade_letter,
              b.description ?? null,
              b.min_score,
              b.max_score,
              b.grade_point ?? 0,
            ],
          );
          inserted.push(rows[0]);
        }
        return inserted;
      });

      if (result === null)
        return reply.status(404).send({ error: "grading scale not found" });

      return reply.status(201).send(result);
    },
  );

  // PATCH /grading-scales/:scaleId/boundaries/:boundaryId
  app.patch<{ Params: { scaleId: string; boundaryId: string } }>(
    "/grading-scales/:scaleId/boundaries/:boundaryId",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateGradeBoundarySchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const updates = parsed.data;
      if (Object.keys(updates).length === 0)
        return reply.status(422).send({ error: "no fields to update" });

      const fields = Object.keys(updates) as (keyof typeof updates)[];
      const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = fields.map((k) => updates[k]);

      const row = await withTenant(tid, (client) =>
        client.query(
          `UPDATE app.grade_boundaries
           SET ${setClauses}
           WHERE id = $1 AND grading_scale_id = $2
           RETURNING ${BOUNDARY_COLS}`,
          [req.params.boundaryId, req.params.scaleId, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "grade boundary not found" });

      return row.rows[0];
    },
  );

  // DELETE /grading-scales/:scaleId/boundaries/:boundaryId
  app.delete<{ Params: { scaleId: string; boundaryId: string } }>(
    "/grading-scales/:scaleId/boundaries/:boundaryId",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `DELETE FROM app.grade_boundaries
           WHERE id = $1 AND grading_scale_id = $2
           RETURNING id`,
          [req.params.boundaryId, req.params.scaleId],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "grade boundary not found" });

      return reply.status(204).send();
    },
  );
}
