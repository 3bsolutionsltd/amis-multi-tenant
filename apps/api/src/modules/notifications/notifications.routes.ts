import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";

const ALL_ROLES = [
  "admin", "registrar", "hod", "instructor",
  "finance", "principal", "dean",
] as const;

const NOTIF_COLS =
  "id, title, body, entity_type, entity_id, link, is_read, created_at";

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /notifications — most recent 50 for the current user
  app.get("/notifications", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId, userId } = req.user;
    if (!tenantId || !userId) return reply.status(400).send({ error: "Authentication required" });

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT ${NOTIF_COLS}
         FROM app.notifications
         WHERE user_id = $1
         ORDER BY is_read ASC, created_at DESC
         LIMIT 50`,
        [userId],
      );
      return rows;
    });

    return reply.send(rows);
  });

  // GET /notifications/unread-count — quick badge count
  app.get("/notifications/unread-count", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId, userId } = req.user;
    if (!tenantId || !userId) return reply.status(400).send({ error: "Authentication required" });

    const count = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM app.notifications WHERE user_id = $1 AND is_read = false`,
        [userId],
      );
      return parseInt(rows[0]?.count ?? "0", 10);
    });

    return reply.send({ count });
  });

  // PATCH /notifications/read-all — mark every notification as read
  app.patch("/notifications/read-all", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId, userId } = req.user;
    if (!tenantId || !userId) return reply.status(400).send({ error: "Authentication required" });

    await withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE app.notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId],
      );
    });

    return reply.status(204).send();
  });

  // PATCH /notifications/:id/read — mark a single notification as read
  app.patch("/notifications/:id/read", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId, userId } = req.user;
    const { id } = req.params as { id: string };
    if (!tenantId || !userId) return reply.status(400).send({ error: "Authentication required" });

    const updated = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE app.notifications
         SET is_read = true
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, userId],
      );
      return rows[0] ?? null;
    });

    if (!updated) return reply.status(404).send({ error: "Notification not found" });
    return reply.status(204).send();
  });
}
