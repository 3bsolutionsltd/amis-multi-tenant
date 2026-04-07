import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Deterministic dev user IDs per role (never used in production)
const ROLE_IDS: Record<string, string> = {
  admin: "00000000-0000-0000-0000-000000000001",
  registrar: "00000000-0000-0000-0000-000000000002",
  hod: "00000000-0000-0000-0000-000000000003",
  instructor: "00000000-0000-0000-0000-000000000004",
  finance: "00000000-0000-0000-0000-000000000005",
  principal: "00000000-0000-0000-0000-000000000006",
};

/**
 * onRequest hook — reads dev identity headers and populates request.user.
 * Must be registered at the ROOT scope via app.addHook() so it fires for
 * every route (including those in nested plugins / sibling register() calls).
 *
 * Headers:
 *   x-tenant-id    → tenantId  (empty string if missing)
 *   x-dev-role     → role      (default: 'admin')
 *   x-dev-user-id  → userId    (default: deterministic UUID for role)
 */
export async function devIdentityHook(req: FastifyRequest): Promise<void> {
  const tenantId =
    typeof req.headers["x-tenant-id"] === "string"
      ? req.headers["x-tenant-id"]
      : "";

  const role =
    typeof req.headers["x-dev-role"] === "string" &&
    req.headers["x-dev-role"].length > 0
      ? req.headers["x-dev-role"]
      : "admin";

  const userId =
    typeof req.headers["x-dev-user-id"] === "string" &&
    req.headers["x-dev-user-id"].length > 0
      ? req.headers["x-dev-user-id"]
      : (ROLE_IDS[role] ?? ROLE_IDS.admin);

  req.user = { tenantId, role, userId };
}

/**
 * Convenience wrapper — registers devIdentityHook at the root Fastify scope.
 * Call once in buildApp() before registering any route plugins.
 */
export function registerDevIdentity(app: FastifyInstance): void {
  app.addHook("onRequest", devIdentityHook);
}

/**
 * Fastify preHandler factory.
 * Returns a hook that responds 403 if request.user.role is not in the allowed list.
 *
 * Usage:
 *   app.post('/route', { preHandler: requireRole('admin', 'registrar') }, handler)
 */
export function requireRole(...roles: string[]) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({
        error: `Forbidden: role '${req.user.role}' is not allowed; requires one of: ${roles.join(", ")}`,
      });
    }
  };
}
