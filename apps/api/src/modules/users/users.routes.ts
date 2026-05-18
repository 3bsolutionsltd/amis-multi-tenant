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
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { superPool as pool } from "../../db/pool.js";
import { hashPasswordAsync } from "../../lib/password.js";
import { isValidPassword } from "../../lib/passwordValidator.js";
import { requireRole } from "../../middleware/requireRole.js";
import { sendMail, buildWelcomeEmail } from "../../lib/email.js";

// ------------------------------------------------------------------ constants

const VALID_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
  "procurement_officer",
  "inventory_manager",
] as const;

// ------------------------------------------------------------------ schemas

const UsersQuerySchema = z.object({
  role: z.string().optional(),
  search: z.string().optional(),
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
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

const UpdateUserSchema = z
  .object({
    role: z.enum(VALID_ROLES).optional(),
    isActive: z.boolean().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
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
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ------------------------------------------------------------------ helper

/** Revoke all refresh tokens for a user (after password change / deactivation). */
async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE platform.refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId],
  );
}

/** Write a row to the IAM audit log (fire-and-forget; never throws). */
function writeAuditLog(
  tenantId: string,
  actorId: string | null,
  targetId: string,
  action: string,
  oldValue: string | null,
  newValue: string | null,
): void {
  pool
    .query(
      `INSERT INTO platform.iam_audit_log
         (tenant_id, actor_id, target_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, actorId ?? null, targetId, action, oldValue ?? null, newValue ?? null],
    )
    .catch((err: unknown) => console.error("[iam_audit_log] write failed:", err));
}

/** Map a DB row to the public user shape (no password_hash). */
function toPublic(row: {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}): UserPublic {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
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

      const { role, search, isActive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      // Build WHERE clauses dynamically
      const conditions: string[] = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];

      if (role !== undefined) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
      }
      if (search !== undefined && search.length > 0) {
        params.push(`%${search.toLowerCase()}%`);
        conditions.push(`lower(email) LIKE $${params.length}`);
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
          last_login_at: string | null;
        }>(
          `SELECT id, email, first_name, last_name, role, is_active, created_at, last_login_at
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

      const { email, password, role, firstName, lastName } = parsed.data;

      // Validate password strength
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

      const passwordHash = await hashPasswordAsync(password);

      const { rows } = await pool.query<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        role: string;
        is_active: boolean;
        created_at: string;
        last_login_at: string | null;
      }>(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role, is_active, created_at, last_login_at`,
        [tenantId, email, passwordHash, role, firstName ?? null, lastName ?? null],
      );

      const created = rows[0];
      writeAuditLog(tenantId, req.user.userId, created.id, "created", null, role);

      // Issue a 48-hour account setup token and send welcome email
      try {
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
        await pool.query(
          `INSERT INTO platform.password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [created.id, tokenHash, expiresAt],
        );
        const appUrl = process.env.APP_URL ?? "http://localhost:5173";
        const setupUrl = `${appUrl}/reset-password?token=${rawToken}&mode=setup`;
        const { html, text } = buildWelcomeEmail(setupUrl, firstName ?? null);
        await sendMail({ to: email, subject: "Welcome to AMIS — Set Up Your Account", html, text });
      } catch (emailErr) {
        // Log but do not fail the request — admin can resend manually
        console.error("[users] Welcome email send failed:", emailErr);
      }

      return reply.status(201).send(toPublic(created));
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

      const { role, isActive, firstName, lastName } = parsed.data;

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
      if (firstName !== undefined) {
        params.push(firstName);
        setClauses.push(`first_name = $${params.length}`);
      }
      if (lastName !== undefined) {
        params.push(lastName);
        setClauses.push(`last_name = $${params.length}`);
      }

      params.push(id);
      const idParam = `$${params.length}`;

      const { rows } = await pool.query<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        role: string;
        is_active: boolean;
        last_login_at: string | null;
        created_at: string;
      }>(
        `UPDATE platform.users
         SET ${setClauses.join(", ")}
         WHERE id = ${idParam}
         RETURNING id, email, first_name, last_name, role, is_active, created_at, last_login_at`,
        params,
      );

      // Revoke refresh tokens when deactivating
      if (isActive === false) {
        await revokeAllRefreshTokens(id);
      }

      const updated = rows[0];
      // Write audit entries for each changed field
      if (role !== undefined) {
        writeAuditLog(
          tenantId, req.user.userId, id, "role_changed",
          existing[0].role, role,
        );
      }
      if (isActive !== undefined) {
        writeAuditLog(
          tenantId, req.user.userId, id,
          isActive ? "activated" : "deactivated",
          null, null,
        );
      }

      return reply.status(200).send(toPublic(updated));
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

      writeAuditLog(tenantId, req.user.userId, id, "password_reset", null, null);

      return reply.status(200).send({ message: "Password updated" });
    },
  );

  // ---------------------------------------------------------------- GET /users/:id

  app.get<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      const { id } = req.params;

      const { rows } = await pool.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
        last_login_at: string | null;
      }>(
        `SELECT id, email, role, is_active, created_at, last_login_at
         FROM platform.users
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );

      if (rows.length === 0) {
        return reply.status(404).send({ message: "User not found" });
      }

      return reply.status(200).send(toPublic(rows[0]));
    },
  );

  // ---------------------------------------------------------------- GET /users/:id/audit-log

  app.get<{ Params: { id: string } }>(
    "/users/:id/audit-log",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      const { id } = req.params;

      // Verify user belongs to this tenant
      const { rows: check } = await pool.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      if (check.length === 0) {
        return reply.status(404).send({ message: "User not found" });
      }

      const { rows } = await pool.query<{
        id: string;
        actor_id: string | null;
        actor_email: string | null;
        action: string;
        old_value: string | null;
        new_value: string | null;
        created_at: string;
      }>(
        `SELECT
           a.id,
           a.actor_id,
           u.email AS actor_email,
           a.action,
           a.old_value,
           a.new_value,
           a.created_at
         FROM platform.iam_audit_log a
         LEFT JOIN platform.users u ON u.id = a.actor_id
         WHERE a.target_id = $1 AND a.tenant_id = $2
         ORDER BY a.created_at DESC
         LIMIT 100`,
        [id, tenantId],
      );

      return reply.status(200).send({
        data: rows.map((r) => ({
          id: r.id,
          actorId: r.actor_id,
          actorEmail: r.actor_email,
          action: r.action,
          oldValue: r.old_value,
          newValue: r.new_value,
          createdAt: r.created_at,
        })),
      });
    },
  );
}
