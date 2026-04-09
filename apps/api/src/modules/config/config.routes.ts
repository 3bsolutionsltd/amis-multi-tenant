import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import { configPayloadSchema } from "./config.schema.js";

export async function configRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------ helpers
  function tenantHeader(req: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const h = req.headers["x-tenant-id"];
    return typeof h === "string" && h.length > 0 ? h : null;
  }

  // ------------------------------------------------------------------ POST /config/draft
  app.post(
    "/config/draft",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const tid = tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = configPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send({ error: "invalid payload", details: parsed.error.flatten() });
      }

      const row = await withTenant(tid, async (client) => {
        await client.query(
          `UPDATE platform.config_versions SET status = 'rolled_back', updated_at = now()
         WHERE tenant_id = $1 AND status = 'draft'`,
          [tid],
        );
        const { rows } = await client.query<{
          id: string;
          status: string;
          payload: unknown;
          created_at: string;
        }>(
          `INSERT INTO platform.config_versions (tenant_id, status, payload)
         VALUES ($1, 'draft', $2)
         RETURNING id, status, payload, created_at`,
          [tid, JSON.stringify(parsed.data)],
        );
        return rows[0];
      });

      return reply.status(201).send(row);
    },
  );

  // ------------------------------------------------------------------ POST /config/validate
  app.post(
    "/config/validate",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const tid = tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const draft = await withTenant(tid, async (client) => {
        const { rows } = await client.query<{ id: string; payload: unknown }>(
          `SELECT id, payload FROM platform.config_versions
         WHERE tenant_id = $1 AND status = 'draft'
         ORDER BY created_at DESC LIMIT 1`,
          [tid],
        );
        return rows[0] ?? null;
      });

      if (!draft)
        return reply
          .status(404)
          .send({ error: "no draft config found for this tenant" });

      const validated = configPayloadSchema.safeParse(draft.payload);
      if (!validated.success) {
        await withTenant(tid, (client) =>
          client.query(
            `UPDATE platform.config_versions SET validation_errors = $1, updated_at = now() WHERE id = $2`,
            [JSON.stringify(validated.error.flatten()), draft.id],
          ),
        );
        return reply
          .status(422)
          .send({ valid: false, errors: validated.error.flatten() });
      }

      await withTenant(tid, (client) =>
        client.query(
          `UPDATE platform.config_versions SET validation_errors = NULL, updated_at = now() WHERE id = $1`,
          [draft.id],
        ),
      );

      return reply.status(200).send({ valid: true, config_id: draft.id });
    },
  );

  // ------------------------------------------------------------------ POST /config/publish
  app.post(
    "/config/publish",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const tid = tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const performedBy =
        typeof body.performed_by === "string" ? body.performed_by : "system";

      const result = await withTenant(tid, async (client) => {
        const { rows: drafts } = await client.query<{
          id: string;
          payload: unknown;
        }>(
          `SELECT id, payload FROM platform.config_versions
         WHERE tenant_id = $1 AND status = 'draft'
         ORDER BY created_at DESC LIMIT 1`,
          [tid],
        );
        const draft = drafts[0] ?? null;
        if (!draft) return { notFound: true } as const;

        const parsed = configPayloadSchema.safeParse(draft.payload);
        if (!parsed.success)
          return {
            validationError: true,
            details: parsed.error.flatten(),
          } as const;

        await client.query(
          `UPDATE platform.config_versions SET status = 'rolled_back', updated_at = now()
         WHERE tenant_id = $1 AND status = 'published'`,
          [tid],
        );

        const { rows } = await client.query<{
          id: string;
          status: string;
          published_at: string;
        }>(
          `UPDATE platform.config_versions
         SET status = 'published', published_at = now(), published_by = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, status, published_at`,
          [draft.id, performedBy],
        );
        const published = rows[0];

        await client.query(
          `INSERT INTO platform.config_audit (tenant_id, config_id, action, performed_by)
         VALUES ($1, $2, 'published', $3)`,
          [tid, published.id, performedBy],
        );

        return published;
      });

      if ("notFound" in result)
        return reply
          .status(404)
          .send({ error: "no draft config found for this tenant" });
      if ("validationError" in result)
        return reply.status(422).send({
          error: "draft has validation errors",
          details: result.details,
        });
      return reply.status(200).send(result);
    },
  );

  // ------------------------------------------------------------------ POST /config/rollback
  app.post(
    "/config/rollback",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const tid = tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const performedBy =
        typeof body.performed_by === "string" ? body.performed_by : "system";

      const result = await withTenant(tid, async (client) => {
        const { rows: published } = await client.query<{ id: string }>(
          `SELECT id FROM platform.config_versions WHERE tenant_id = $1 AND status = 'published' LIMIT 1`,
          [tid],
        );
        if (!published[0]) return { notFound: true } as const;

        const currentId = published[0].id;

        const { rows: previous } = await client.query<{
          id: string;
          payload: unknown;
        }>(
          `SELECT id, payload FROM platform.config_versions
         WHERE tenant_id = $1 AND status = 'rolled_back' AND id != $2 AND published_at IS NOT NULL
         ORDER BY published_at DESC LIMIT 1`,
          [tid, currentId],
        );
        const prev = previous[0] ?? null;

        await client.query(
          `UPDATE platform.config_versions SET status = 'rolled_back', updated_at = now() WHERE id = $1`,
          [currentId],
        );

        let rolledBackTo = null;
        if (prev) {
          const { rows } = await client.query<{
            id: string;
            status: string;
            published_at: string;
          }>(
            `INSERT INTO platform.config_versions (tenant_id, status, payload, published_at, published_by, rollback_of)
           VALUES ($1, 'published', $2, now(), $3, $4)
           RETURNING id, status, published_at`,
            [tid, JSON.stringify(prev.payload), performedBy, currentId],
          );
          rolledBackTo = rows[0];
        }

        await client.query(
          `INSERT INTO platform.config_audit (tenant_id, config_id, action, performed_by, metadata)
         VALUES ($1, $2, 'rolled_back', $3, $4)`,
          [
            tid,
            currentId,
            performedBy,
            JSON.stringify({ rolled_back_to: rolledBackTo?.id ?? null }),
          ],
        );

        return { rolled_back: currentId, restored: rolledBackTo };
      });

      if ("notFound" in result)
        return reply
          .status(404)
          .send({ error: "no published config found for this tenant" });
      return reply.status(200).send(result);
    },
  );

  // ------------------------------------------------------------------ GET /config
  app.get(
    "/config",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "instructor",
        "finance",
        "principal",
        "dean",
      ),
    },
    async (req, reply) => {
      const tid = tenantHeader(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, async (client) => {
        const { rows } = await client.query<{
          id: string;
          status: string;
          payload: unknown;
          published_at: string | null;
          published_by: string | null;
          created_at: string;
        }>(
          `SELECT id, status, payload, published_at, published_by, created_at
         FROM platform.config_versions
         WHERE tenant_id = $1
         ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at DESC
         LIMIT 1`,
          [tid],
        );
        return rows[0] ?? null;
      });

      if (!row)
        return reply
          .status(404)
          .send({ error: "no config found for this tenant" });
      return reply.status(200).send(row);
    },
  );

  // ------------------------------------------------------------------ GET /config/status
  // Returns the latest published and latest draft configs for the tenant.
  // Used by Admin Studio dashboard and editor.
  app.get("/config/status", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const result = await withTenant(tid, async (client) => {
      const { rows: published } = await client.query<{
        id: string;
        status: string;
        payload: unknown;
        published_at: string | null;
        published_by: string | null;
        created_at: string;
      }>(
        `SELECT id, status, payload, published_at, published_by, created_at
         FROM platform.config_versions
         WHERE tenant_id = $1 AND status = 'published'
         ORDER BY created_at DESC LIMIT 1`,
        [tid],
      );
      const { rows: drafts } = await client.query<{
        id: string;
        status: string;
        payload: unknown;
        published_at: string | null;
        published_by: string | null;
        created_at: string;
      }>(
        `SELECT id, status, payload, published_at, published_by, created_at
         FROM platform.config_versions
         WHERE tenant_id = $1 AND status = 'draft'
         ORDER BY created_at DESC LIMIT 1`,
        [tid],
      );
      return { published: published[0] ?? null, draft: drafts[0] ?? null };
    });

    return reply.status(200).send(result);
  });

  // ------------------------------------------------------------------ GET /config/audit
  // Returns recent audit log entries for the tenant.
  // Query param: limit (default 5, max 20).
  app.get("/config/audit", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const query = req.query as Record<string, string | undefined>;
    const limit = Math.min(Number(query.limit ?? "5") || 5, 20);

    const rows = await withTenant(tid, async (client) => {
      const { rows: entries } = await client.query<{
        id: string;
        config_id: string;
        action: string;
        performed_by: string;
        metadata: unknown;
        created_at: string;
      }>(
        `SELECT id, config_id, action, performed_by, metadata, created_at
         FROM platform.config_audit
         WHERE tenant_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [tid, limit],
      );
      return entries;
    });

    return reply.status(200).send(rows);
  });
}
