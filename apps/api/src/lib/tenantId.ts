import type { FastifyRequest } from "fastify";

/**
 * Extract tenant ID from the authenticated request user context.
 * Returns null if tenantId is missing so callers can respond 400.
 */
export function getTenantId(req: FastifyRequest): string | null {
  const tid = req.user?.tenantId;
  return typeof tid === "string" && tid.length > 0 ? tid : null;
}
