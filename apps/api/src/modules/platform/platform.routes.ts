/**
 * Platform management routes
 *
 * GET /platform/users  — list all platform admin users (platform_admin only)
 */
import type { FastifyInstance } from "fastify";
import { superPool } from "../../db/pool.js";
import { requireRole } from "../../middleware/requireRole.js";

export async function platformRoutes(app: FastifyInstance) {
  /**
   * GET /platform/users
   * Returns all users with role = 'platform_admin'.
   * Accessible only to platform_admin.
   */
  app.get(
    "/platform/users",
    { preHandler: requireRole("platform_admin") },
    async (_req, reply) => {
      const { rows } = await superPool.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
      }>(
        `SELECT id, email, role, is_active, created_at
         FROM platform.users
         WHERE role = 'platform_admin'
         ORDER BY created_at ASC`,
      );
      return reply.send(rows);
    },
  );
}
