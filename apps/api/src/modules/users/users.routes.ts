/**
 * User management routes — Prompt 19
 *
 * GET    /users           — list tenant users (admin only)
 * POST   /users           — create user in tenant (admin only)
 * PUT    /users/:id       — update role / isActive (admin only)
 * PUT    /users/:id/password — admin resets any user's password (admin only)
 *
 * All endpoints use the superuser pool (bypass RLS) and manually filter
 * by tenant_id from request.user.tenantId so tenant isolation is explicit.
 * password_hash is NEVER returned in any response.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { hashPassword } from "../../lib/password.js";
import { isValidPassword } from "../../lib/passwordValidator.js";
import { requireRole } from "../../middleware/requireRole.js";

// ------------------------------------------------------------------ constants

const VALID_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

// ------------------------------------------------------------------ schemas

const UsersQuerySchema = z.object({
  role: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(VALID_ROLES),
});

const UpdateUserSchema = z
  .object({
    role: z.enum(VALID_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, {
    message: "At least one of role or isActive must be provided",
  });

const UpdatePasswordSchema = z.object({
  newPassword: z.string().min(1),
});

// ------------------------------------------------------------------ types

interface UserPublic {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// ------------------------------------------------------------------ helper

/** Revoke all refresh tokens for a user (after password change / deactivation). */
async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE platform.refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId],
  );
}

/** Map a DB row to the public user shape (no password_hash). */
function toPublic(row: {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}): UserPublic {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// ------------------------------------------------------------------ routes

export async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /users
   * Query: ?role=admin&isActive=true&page=1&limit=20
   * Returns paginated list of users for the caller's tenant (admin only).
   */
  app.get(
    "/users",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { tenantId } = req.user;

      const parsed = UsersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ statusCode: 400, message: "Invalid query parameters" });
      }

      const { role, isActive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      // Build WHERE clauses dynamically
      const conditions: string[] = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];

      if (role !== undefined) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
      }
      if (isActive !== undefined) {
        params.push(isActive);
        conditions.push(`is_active = $${params.length}`);
      }

      const where = conditions.join(" AND ");

      const [dataResult, countResult] = await Promise.all([
        pool.query<{
          id: string;
          email: string;
          role: string;
          is_active: boolean;
          created_at: string;
        }>(
          `SELECT id, email, role, is_active, created_at
           FROM platform.users
           WHERE ${where}
           ORDER BY created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM platform.users WHERE ${where}`,
          params,
        ),
      ]);

      return reply.status(200).send({
        data: dataResult.rows.map(toPublic),
        total: Number(countResult.rows[0].count),
        page,
        limit,
      });
    },
  );

  /**
   * POST /users
   * Body: { email, password, role }
   * Creates a new user in the caller's tenant (admin only).
   */
  app.post(
    "/users",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { tenantId } = req.user;

      const parsed = CreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          message: "Invalid request body",
          errors: parsed.error.flatten(),
        });
      }

      const { email, password, role } = parsed.data;

      if (!isValidPassword(password)) {
        return reply
          .status(400)
          .send({ message: "Password does not meet requirements" });
      }

      // Check uniqueness (tenant_id + email)
      const { rows: existing } = await pool.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, email],
      );
      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ message: "A user with that email already exists" });
      }

      const passwordHash = hashPassword(password);

      const { rows } = await pool.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
      }>(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, is_active, created_at`,
        [tenantId, email, passwordHash, role],
      );

      return reply.status(201).send(toPublic(rows[0]));
    },
  );

  /**
   * PUT /users/:id
   * Body: { role?, isActive? }
   * Update role and/or active status for a user in the same tenant (admin only).
   */
  app.put<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      const { id } = req.params;

      const parsed = UpdateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          message: "Invalid request body",
          errors: parsed.error.flatten(),
        });
      }

      const { role, isActive } = parsed.data;

      // Verify the user belongs to the same tenant
      const { rows: existing } = await pool.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
      }>(
        `SELECT id, email, role, is_active, created_at
         FROM platform.users
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );

      if (existing.length === 0) {
        return reply.status(404).send({ message: "User not found" });
      }

      // Build SET clause
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (role !== undefined) {
        params.push(role);
        setClauses.push(`role = $${params.length}`);
      }
      if (isActive !== undefined) {
        params.push(isActive);
        setClauses.push(`is_active = $${params.length}`);
      }

      params.push(id);
      const idParam = `$${params.length}`;

      const { rows } = await pool.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
      }>(
        `UPDATE platform.users
         SET ${setClauses.join(", ")}
         WHERE id = ${idParam}
         RETURNING id, email, role, is_active, created_at`,
        params,
      );

      // Revoke refresh tokens when deactivating
      if (isActive === false) {
        await revokeAllRefreshTokens(id);
      }

      return reply.status(200).send(toPublic(rows[0]));
    },
  );

  /**
   * PUT /users/:id/password
   * Body: { newPassword }
   * Admin resets any user's password in the same tenant.
   */
  app.put<{ Params: { id: string } }>(
    "/users/:id/password",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      const { id } = req.params;

      const parsed = UpdatePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ statusCode: 400, message: "Invalid request body" });
      }

      const { newPassword } = parsed.data;

      if (!isValidPassword(newPassword)) {
        return reply
          .status(400)
          .send({ message: "Password does not meet requirements" });
      }

      // Verify user belongs to same tenant
      const { rows: existing } = await pool.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );

      if (existing.length === 0) {
        return reply.status(404).send({ message: "User not found" });
      }

      const passwordHash = hashPassword(newPassword);

      await pool.query(
        `UPDATE platform.users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, id],
      );

      await revokeAllRefreshTokens(id);

      return reply.status(200).send({ message: "Password updated" });
    },
  );
}
