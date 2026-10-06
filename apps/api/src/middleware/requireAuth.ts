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
import { superPool } from "../db/pool.js";
import { verifyToken } from "../lib/jwt.js";

/** Routes that never require authentication. */
const PUBLIC_PATHS = new Set([
  "POST /auth/login",
  "POST /auth/platform-login",
  "POST /auth/refresh",
  "POST /auth/logout",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "GET /auth/tenant-info",
  "GET /health",
  "POST /onboarding", // VTI self-registration is public
  "GET /tenants/verify-email", // contact email verification link (public)
]);

/** Route prefixes that never require authentication. */
const PUBLIC_PREFIXES = ["/public/", "/webhooks/"];

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
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;

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
  // Use superPool (postgres superuser) to bypass RLS — requireAuth runs before
  // any tenant context is established, so the amis_app role would see 0 rows.
  const { rows } = await superPool.query<{
    id: string;
    role: string;
    roles: string[];
    tenant_id: string;
    is_active: boolean;
  }>(
    `SELECT u.id, u.role, u.tenant_id, u.is_active,
        COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[u.role]) AS roles
     FROM platform.users u
     LEFT JOIN platform.user_roles ur ON ur.user_id = u.id
     LEFT JOIN platform.roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id, u.role, u.tenant_id, u.is_active`,
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
    roles: rows[0].roles,
  };
}
