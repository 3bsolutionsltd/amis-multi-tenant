import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import {
  CreateProgrammeSchema,
  UpdateProgrammeSchema,
  ProgrammesQuerySchema,
} from "./programmes.schema.js";

const SELECT_COLS =
  "id, code, title, department, duration_months, level, is_active, created_at, updated_at";

const WRITE_ROLES = ["registrar", "admin"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

export async function programmesRoutes(app: FastifyInstance) {
  // GET /programmes — full catalogue for tenant
  app.get(
    "/programmes",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ProgrammesQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { search, include_inactive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push(`is_active = true`);
        }

        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(code ILIKE $${params.length} OR title ILIKE $${params.length} OR department ILIKE $${params.length})`,
          );
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${SELECT_COLS} FROM app.programmes
           ${where}
           ORDER BY code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /programmes/:id — single programme
  app.get<{ Params: { id: string } }>(
    "/programmes/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${SELECT_COLS} FROM app.programmes WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "programme not found" });

      return row.rows[0];
    },
  );

  // POST /programmes — create
  app.post(
    "/programmes",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateProgrammeSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { code, title, department, duration_months, level } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.programmes
             (tenant_id, code, title, department, duration_months, level)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${SELECT_COLS}`,
          [tenantId, code, title, department ?? null, duration_months ?? null, level ?? null],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /programmes/:id — update
  app.patch<{ Params: { id: string } }>(
    "/programmes/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateProgrammeSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const updates = parsed.data;
      if (Object.keys(updates).length === 0)
        return reply.status(422).send({ error: "no fields to update" });

      const fields = Object.keys(updates) as (keyof typeof updates)[];
      const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = fields.map((k) => updates[k]);

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.programmes
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "programme not found" });

      return row.rows[0];
    },
  );

  // DELETE /programmes/:id — soft delete (set is_active = false)
  app.delete<{ Params: { id: string } }>(
    "/programmes/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.programmes
           SET is_active = false, updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "programme not found" });

      return reply.status(204).send();
    },
  );
}
