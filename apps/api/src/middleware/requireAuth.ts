/**
 * requireAuth — onRequest hook (Prompt 18)
 *
 * Execution order (registered AFTER devIdentityHook in buildApp):
 *
 *   dev/test, no Bearer  → devIdentity already set req.user → this hook skips
 *   dev/test, Bearer     → devIdentity skipped (saw Bearer) → this hook does JWT auth
 *   production           → devIdentity skipped (prod mode)  → this hook does JWT auth
 *
 * Public routes (require no auth in any mode):
 *   POST /auth/login | POST /auth/refresh | POST /auth/logout | GET /health
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../db/pool.js";
import { verifyToken } from "../lib/jwt.js";

/** Routes that never require authentication. */
const PUBLIC_PATHS = new Set([
  "POST /auth/login",
  "POST /auth/refresh",
  "POST /auth/logout",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "GET /health",
]);

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 1. devIdentity already populated req.user (dev/test without Bearer) → pass through
  if ((req as unknown as { user?: object }).user !== undefined) return;

  // 2. Public routes need no auth token in any mode
  const path = req.url.split("?")[0];
  const routeKey = `${req.method} ${path}`;
  if (PUBLIC_PATHS.has(routeKey)) return;

  // 3. Require Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    void reply.status(401).send({ message: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);

  // 4. Verify JWT signature + expiry
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    void reply.status(401).send({ message: "Invalid or expired token" });
    return;
  }

  // 5. Look up the user in the DB (catches deleted / inactive accounts)
  const { rows } = await pool.query<{
    id: string;
    role: string;
    tenant_id: string;
    is_active: boolean;
  }>(
    `SELECT id, role, tenant_id, is_active
     FROM platform.users
     WHERE id = $1`,
    [payload.sub],
  );

  if (rows.length === 0 || !rows[0].is_active) {
    void reply.status(401).send({ message: "Invalid or expired token" });
    return;
  }

  // 6. Set identity — same shape as devIdentity so all existing code works
  req.user = {
    userId: rows[0].id,
    tenantId: rows[0].tenant_id,
    role: rows[0].role,
  };
}
