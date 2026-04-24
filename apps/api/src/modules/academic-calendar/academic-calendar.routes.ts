import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateAcademicYearSchema,
  UpdateAcademicYearSchema,
  AcademicYearsQuerySchema,
  CreateTermSchema,
  UpdateTermSchema,
  TermsQuerySchema,
} from "./academic-calendar.schema.js";

// ------------------------------------------------------------------ constants

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

const AY_COLS =
  "id, tenant_id, name, start_date, end_date, is_current, created_at, updated_at";

const TERM_COLS =
  "id, tenant_id, academic_year_id, name, term_number, start_date, end_date, is_current, created_at, updated_at";

// ------------------------------------------------------------------ routes

export async function academicCalendarRoutes(app: FastifyInstance) {
  // ======================== Academic Years ========================

  // GET /academic-years
  app.get(
    "/academic-years",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = AcademicYearsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { is_current, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (is_current !== undefined) {
          params.push(is_current);
          conditions.push(`is_current = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${AY_COLS} FROM app.academic_years
           ${where}
           ORDER BY start_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /academic-years/:id
  app.get<{ Params: { id: string } }>(
    "/academic-years/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `SELECT ${AY_COLS} FROM app.academic_years WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "academic year not found" });

      return row.rows[0];
    },
  );

  // POST /academic-years
  app.post(
    "/academic-years",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateAcademicYearSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { name, start_date, end_date, is_current } = parsed.data;

      const row = await withTenant(tid, (client) =>
        client.query(
          `INSERT INTO app.academic_years
             (tenant_id, name, start_date, end_date, is_current)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${AY_COLS}`,
          [tid, name, start_date, end_date, is_current ?? false],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /academic-years/:id
  app.patch<{ Params: { id: string } }>(
    "/academic-years/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateAcademicYearSchema.safeParse(req.body);
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
          `UPDATE app.academic_years
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${AY_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "academic year not found" });

      return row.rows[0];
    },
  );

  // ======================== Terms ========================

  // GET /terms
  app.get(
    "/terms",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = TermsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year_id, is_current, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (academic_year_id) {
          params.push(academic_year_id);
          conditions.push(`academic_year_id = $${params.length}`);
        }
        if (is_current !== undefined) {
          params.push(is_current);
          conditions.push(`is_current = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${TERM_COLS} FROM app.terms
           ${where}
           ORDER BY term_number ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /terms/:id
  app.get<{ Params: { id: string } }>(
    "/terms/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `SELECT ${TERM_COLS} FROM app.terms WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "term not found" });

      return row.rows[0];
    },
  );

  // POST /terms
  app.post(
    "/terms",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateTermSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year_id, name, term_number, start_date, end_date, is_current } =
        parsed.data;

      try {
        const row = await withTenant(tid, (client) =>
          client.query(
            `INSERT INTO app.terms
               (tenant_id, academic_year_id, name, term_number, start_date, end_date, is_current)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING ${TERM_COLS}`,
            [tid, academic_year_id, name, term_number, start_date, end_date, is_current ?? false],
          ),
        );
        return reply.status(201).send(row.rows[0]);
      } catch (err: unknown) {
        const pgCode = (err as { code?: string })?.code;
        if (pgCode === "23505") {
          return reply.status(409).send({ error: "A term with that number already exists for this year, or only one current term is allowed per tenant." });
        }
        if (pgCode === "23503") {
          return reply.status(422).send({ error: "The specified academic year does not exist." });
        }
        throw err;
      }
    },
  );

  // PATCH /terms/:id
  app.patch<{ Params: { id: string } }>(
    "/terms/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateTermSchema.safeParse(req.body);
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
          `UPDATE app.terms
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${TERM_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "term not found" });

      return row.rows[0];
    },
  );
}
