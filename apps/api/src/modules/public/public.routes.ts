import type { FastifyInstance } from "fastify";
import { pool } from "../../db/pool.js";
import { withTenant } from "../../db/tenant.js";
import { PublicApplySchema } from "./public.schema.js";

// ------------------------------------------------------------------ helpers

async function resolveTenantSlug(
  slug: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM platform.tenants WHERE slug = $1 AND is_active = true`,
    [slug],
  );
  return rows[0]?.id ?? null;
}

// ------------------------------------------------------------------ routes

export async function publicRoutes(app: FastifyInstance) {
  // ---------- POST /public/:tenantSlug/apply
  // No auth required — public-facing applicant endpoint
  app.post<{ Params: { tenantSlug: string } }>(
    "/public/:tenantSlug/apply",
    async (req, reply) => {
      const tenantId = await resolveTenantSlug(req.params.tenantSlug);
      if (!tenantId)
        return reply.status(404).send({ error: "institution not found" });

      const parse = PublicApplySchema.safeParse(req.body);
      if (!parse.success)
        return reply
          .status(422)
          .send({ error: "validation failed", issues: parse.error.issues });

      const d = parse.data;

      const result = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.admission_applications
             (tenant_id, first_name, last_name, programme, intake,
              dob, gender, email, phone, sponsorship_type, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'online')
           RETURNING id, first_name, last_name, programme, intake, created_at`,
          [
            tenantId,
            d.first_name,
            d.last_name,
            d.programme,
            d.intake,
            d.dob ?? null,
            d.gender ?? null,
            d.email ?? null,
            d.phone ?? null,
            d.sponsorship_type ?? null,
          ],
        );
        return rows[0];
      });

      return reply.status(201).send({ application: result });
    },
  );

  // ---------- GET /public/:tenantSlug/applications/:id/status
  // No auth — applicants can check their application status
  app.get<{ Params: { tenantSlug: string; id: string } }>(
    "/public/:tenantSlug/applications/:id/status",
    async (req, reply) => {
      const tenantId = await resolveTenantSlug(req.params.tenantSlug);
      if (!tenantId)
        return reply.status(404).send({ error: "institution not found" });

      const result = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT a.id, a.first_name, a.last_name, a.programme, a.intake,
                  a.created_at, wi.current_state
           FROM app.admission_applications a
           LEFT JOIN app.workflow_instances wi ON wi.entity_id = a.id
           WHERE a.id = $1`,
          [req.params.id],
        );
        return rows[0] ?? null;
      });

      if (!result)
        return reply.status(404).send({ error: "application not found" });

      return { application: result };
    },
  );
}
