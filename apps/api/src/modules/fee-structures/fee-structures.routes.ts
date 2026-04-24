import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateFeeStructureSchema,
  UpdateFeeStructureSchema,
  FeeStructuresQuerySchema,
} from "./fee-structures.schema.js";

// ------------------------------------------------------------------ constants

const WRITE_ROLES = ["finance", "admin"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "finance",
  "principal",
  "dean",
] as const;

const FS_COLS =
  "id, tenant_id, academic_year_id, term_id, programme_id, fee_type, student_category, description, amount, currency, is_active, created_at, updated_at";

// ------------------------------------------------------------------ routes

export async function feeStructuresRoutes(app: FastifyInstance) {
  // GET /fee-structures
  app.get(
    "/fee-structures",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = FeeStructuresQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        academic_year_id,
        term_id,
        programme_id,
        fee_type,
        student_category,
        include_inactive,
        page,
        limit,
      } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push(`fs.is_active = true`);
        }
        if (academic_year_id) {
          params.push(academic_year_id);
          conditions.push(`fs.academic_year_id = $${params.length}`);
        }
        if (term_id) {
          params.push(term_id);
          conditions.push(`fs.term_id = $${params.length}`);
        }
        if (programme_id) {
          params.push(programme_id);
          conditions.push(`fs.programme_id = $${params.length}`);
        }
        if (fee_type) {
          params.push(fee_type);
          conditions.push(`fs.fee_type = $${params.length}`);
        }
        if (student_category) {
          params.push(student_category);
          conditions.push(`fs.student_category = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT fs.id, fs.tenant_id, fs.academic_year_id, fs.term_id, fs.programme_id,
                  fs.fee_type, fs.student_category, fs.description, fs.amount, fs.currency, fs.is_active,
                  fs.created_at, fs.updated_at,
                  ay.name AS academic_year_name,
                  p.code AS programme_code, p.title AS programme_title
           FROM app.fee_structures fs
           LEFT JOIN app.academic_years ay ON ay.id = fs.academic_year_id
           LEFT JOIN app.programmes p ON p.id = fs.programme_id
           ${where}
           ORDER BY fs.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /fee-structures/:id
  app.get<{ Params: { id: string } }>(
    "/fee-structures/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `SELECT ${FS_COLS} FROM app.fee_structures WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "fee structure not found" });

      return row.rows[0];
    },
  );

  // POST /fee-structures
  app.post(
    "/fee-structures",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateFeeStructureSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { academic_year_id, term_id, programme_id, fee_type, student_category, description, amount, currency } =
        parsed.data;

      const row = await withTenant(tid, (client) =>
        client.query(
          `INSERT INTO app.fee_structures
             (tenant_id, academic_year_id, term_id, programme_id, fee_type, student_category, description, amount, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING ${FS_COLS}`,
          [
            tid,
            academic_year_id,
            term_id ?? null,
            programme_id,
            fee_type ?? "tuition",
            student_category ?? "all",
            description ?? null,
            amount,
            currency ?? "UGX",
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /fee-structures/:id
  app.patch<{ Params: { id: string } }>(
    "/fee-structures/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateFeeStructureSchema.safeParse(req.body);
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
          `UPDATE app.fee_structures
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${FS_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "fee structure not found" });

      return row.rows[0];
    },
  );
}
