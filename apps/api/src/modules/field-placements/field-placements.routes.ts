import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import {
  CreateFieldPlacementSchema,
  UpdateFieldPlacementSchema,
  FieldPlacementsQuerySchema,
} from "./field-placements.schema.js";

function getTenantId(req: {
  user?: { tenantId?: string };
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const fromUser = req.user?.tenantId;
  if (fromUser) return fromUser;
  const h = req.headers["x-tenant-id"];
  return typeof h === "string" && h.length > 0 ? h : null;
}

export async function fieldPlacementsRoutes(app: FastifyInstance) {
  // ---------- GET /field-placements
  app.get(
    "/field-placements",
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

      const parsed = FieldPlacementsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, placement_type, status, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (student_id) {
          params.push(student_id);
          conditions.push(`fp.student_id = $${params.length}`);
        }
        if (placement_type) {
          params.push(placement_type);
          conditions.push(`fp.placement_type = $${params.length}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`fp.status = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        const limitIdx = params.length - 1;
        const offsetIdx = params.length;

        const { rows: data } = await client.query(
          `SELECT fp.*,
                  s.first_name, s.last_name
           FROM app.field_placements fp
           LEFT JOIN app.students s ON s.id = fp.student_id
           WHERE fp.tenant_id = $1 ${where}
           ORDER BY fp.created_at DESC
           LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          params,
        );
        return data;
      });

      return rows;
    },
  );

  // ---------- GET /field-placements/:id
  app.get<{ Params: { id: string } }>(
    "/field-placements/:id",
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
          `SELECT fp.*,
                  s.first_name, s.last_name
           FROM app.field_placements fp
           LEFT JOIN app.students s ON s.id = fp.student_id
           WHERE fp.id = $1`,
          [id],
        );
        return rows[0] ?? null;
      });

      if (!row) return reply.status(404).send({ error: "not found" });
      return row;
    },
  );

  // ---------- POST /field-placements
  app.post(
    "/field-placements",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateFieldPlacementSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        student_id,
        host_organisation,
        supervisor,
        placement_type,
        start_date,
        end_date,
        status,
        notes,
      } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.field_placements
             (tenant_id, student_id, host_organisation, supervisor, placement_type,
              start_date, end_date, status, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            tid,
            student_id,
            host_organisation,
            supervisor ?? null,
            placement_type,
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

  // ---------- PATCH /field-placements/:id
  app.patch<{ Params: { id: string } }>(
    "/field-placements/:id",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateFieldPlacementSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { id } = req.params;
      const updates = parsed.data;

      const row = await withTenant(tid, async (client) => {
        const fields: string[] = [];
        const params: unknown[] = [];

        const allowed = [
          "host_organisation",
          "supervisor",
          "placement_type",
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
          `UPDATE app.field_placements
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
}
