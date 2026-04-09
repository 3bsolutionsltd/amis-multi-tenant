/**
 * requireRole — preHandler factory (Prompt 18)
 *
 * Separate from devIdentity.ts so new tests can import it independently.
 * Works with identities set by EITHER devIdentity OR requireAuth.
 *
 * Usage:
 *   app.post('/route', { preHandler: requireRole('admin', 'registrar') }, handler)
 */
import type { FastifyRequest, FastifyReply } from "fastify";

export function requireRole(...roles: string[]) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    // Identity must have been set by devIdentity or requireAuth
    if ((req as unknown as { user?: object }).user === undefined) {
      return reply.status(401).send({ message: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({
        error: `Forbidden: role '${req.user.role}' is not allowed; requires one of: ${roles.join(", ")}`,
      });
    }
  };
}
