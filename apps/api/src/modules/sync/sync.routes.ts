import type { FastifyInstance } from "fastify";
import { superPool } from "../../db/pool.js";
import { getOutboxQueue } from "../../lib/queue.js";

export async function syncRoutes(app: FastifyInstance) {
  /**
   * GET /sync/status
   * Returns outbox queue depth (unprocessed event count) and the
   * timestamp of the last processed event.
   * Requires admin role.
   */
  app.get("/sync/status", async (req, reply) => {
    const user = (req as unknown as { user?: { role?: string } }).user;
    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Authentication required" });
    }
    if (user.role !== "admin" && user.role !== "platform_admin") {
      return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
    }

    const queueDepthResult = await superPool.query<{ depth: string }>(
      `SELECT COUNT(*) AS depth
         FROM platform.outbox_events
        WHERE processed_at IS NULL`
    );

    const lastProcessedResult = await superPool.query<{ last_processed: string | null }>(
      `SELECT MAX(processed_at) AS last_processed
         FROM platform.outbox_events`
    );

    const queue = getOutboxQueue();
    const redisConnected = queue !== null;

    return reply.status(200).send({
      queueDepth: parseInt(queueDepthResult.rows[0].depth, 10),
      lastProcessedAt: lastProcessedResult.rows[0].last_processed ?? null,
      workerActive: redisConnected,
    });
  });
}
