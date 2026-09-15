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
import { superPool } from "../db/pool.js";

const PATH_MODULES: Array<[string, string]> = [
  ["/students", "Students"],
  ["/admissions", "Admissions"],
  ["/term-registrations", "Term Registrations"],
  ["/programmes", "Programmes"],
  ["/marks", "Marks"],
  ["/results", "Results"],
  ["/fees", "Finance / Fees"],
  ["/fee-structures", "Finance / Fees"],
  ["/procurement", "Procurement"],
  ["/inventory", "Inventory"],
  ["/stores", "Stores / SRQ / PCV"],
  ["/staff", "Staff / HR"],
  ["/users", "Users / IAM"],
  ["/timetable", "Timetable"],
  ["/attendance", "Attendance"],
  ["/clearance", "Clearance"],
  ["/industrial-training", "Industrial Training"],
  ["/field-placements", "Field Placements"],
  ["/student-projects", "Student Projects"],
  ["/alumni", "Alumni"],
  ["/analytics", "Analytics"],
  ["/reports", "Reports"],
  ["/config", "Admin Studio"],
];

const ROLE_ALIASES: Record<string, string> = {
  procurement_officer: "proc.",
  inventory_manager: "inv.",
};

function moduleForPath(path: string): string | null {
  if (path.startsWith("/workflow/")) {
    if (path.includes("/marks/")) return "Marks";
    if (path.includes("purchase_requisition")) return "Procurement";
  }
  return PATH_MODULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}

export async function hasConfiguredPermission(req: FastifyRequest, assignedRoles: string[]): Promise<boolean> {
  const module = moduleForPath(req.url.split("?")[0]);
  if (!module || assignedRoles.includes("admin") || assignedRoles.includes("platform_admin")) return false;

  const { rows } = await superPool.query<{
    permissions?: Record<string, Record<string, "full" | "read" | "none">>;
  }>(
    `SELECT payload->'permissions' AS permissions
     FROM platform.config_versions
     WHERE tenant_id = $1 AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [req.user.tenantId],
  );
  const permissions = rows[0]?.permissions;
  if (!permissions) return false;

  const requiredAccess = req.method === "GET" || req.method === "HEAD" ? ["read", "full"] : ["full"];
  return assignedRoles.some((role) => {
    const rolePermissions = permissions[role] ?? permissions[ROLE_ALIASES[role] ?? ""];
    return requiredAccess.includes(rolePermissions?.[module] ?? "none");
  });
}

export function requireRole(...roles: string[]) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    // Identity must have been set by devIdentity or requireAuth
    if ((req as unknown as { user?: object }).user === undefined) {
      return reply.status(401).send({ message: "Authentication required" });
    }
    const assignedRoles = req.user.roles?.length ? req.user.roles : [req.user.role];
    const hasLegacyRole = roles.some((requiredRole) => assignedRoles.includes(requiredRole));
    const hasConfiguredAccess = !hasLegacyRole && await hasConfiguredPermission(req, assignedRoles);
    if (!hasLegacyRole && !hasConfiguredAccess) {
      return reply.status(403).send({
        error: `Forbidden: roles '${assignedRoles.join(", ")}' are not allowed; requires one of: ${roles.join(", ")}`,
      });
    }
  };
}
