/**
 * Tenant management routes — Phase 1.2
 *
 * GET    /tenants                   — list all tenants (platform_admin only)
 * GET    /tenants/:id               — get single tenant (platform_admin only)
 * POST   /tenants                   — create tenant (platform_admin only)
 * PUT    /tenants/:id               — update tenant (platform_admin only)
 * DELETE /tenants/:id               — delete tenant (platform_admin only)
 * GET    /tenants/verify-email      — verify contact email via token (public)
 *
 * All write endpoints are platform_admin-only and operate on the platform.tenants table.
 */
import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { pool, superPool, isConnectionError } from "../../db/pool.js";
import { requireRole } from "../../middleware/requireRole.js";
import { sendMail, buildTenantVerificationEmail } from "../../lib/email.js";

// ------------------------------------------------------------------ schemas

const CreateTenantSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(255),
  contactEmail: z.string().email().optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  isActive: z.boolean().optional(),
});

const UpdateTenantSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    contactEmail: z.string().email().nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.contactEmail !== undefined ||
      d.address !== undefined ||
      d.phone !== undefined ||
      d.logoUrl !== undefined ||
      d.isActive !== undefined,
    { message: "At least one field must be provided" },
  );

const TenantsQuerySchema = z.object({
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
    .pipe(z.number().int().min(1).max(500).default(20)),
});

// ------------------------------------------------------------------ types

interface TenantPublic {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  contactEmail: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ helper

function toPublic(row: {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  contact_email: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  created_at: string;
}): TenantPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active,
    contactEmail: row.contact_email,
    address: row.address,
    phone: row.phone,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

// ------------------------------------------------------------------ routes

export async function tenantsRoutes(app: FastifyInstance) {
  /**
   * GET /tenants
   * Query: ?isActive=true&page=1&limit=20
   */
  /**
   * GET /tenants/me  — VTI admin reads their own tenant profile
   */
  app.get(
    "/tenants/me",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor", "finance", "principal", "dean", "procurement_officer", "inventory_manager") },
    async (req, reply) => {
      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ message: "No tenant context" });
      }
      const result = await pool.query(
        `SELECT id, slug, name, is_active, contact_email, address, phone, logo_url, created_at, setup_completed
         FROM platform.tenants WHERE id = $1`,
        [tenantId],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ message: "Tenant not found" });
      }
      const row = result.rows[0];
      return {
        ...toPublic(row),
        setupCompleted: row.setup_completed as boolean,
      };
    },
  );

  /**
   * PUT /tenants/me  — VTI admin updates their own tenant profile
   */
  app.put(
    "/tenants/me",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ message: "No tenant context" });
      }

      const MeUpdateSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        contactEmail: z.string().email().nullable().optional(),
        address: z.string().max(500).nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        logoUrl: z.string().url().max(2048).nullable().optional(),
        setupCompleted: z.boolean().optional(),
      });

      const parsed = MeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: parsed.error.issues });
      }

      const fieldMap: Record<string, string> = {
        name: "name",
        contactEmail: "contact_email",
        address: "address",
        phone: "phone",
        logoUrl: "logo_url",
        setupCompleted: "setup_completed",
      };

      const setClauses: string[] = [];
      const params: unknown[] = [tenantId];

      for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
        const val = parsed.data[jsKey as keyof typeof parsed.data];
        if (val !== undefined) {
          params.push(val);
          setClauses.push(`${dbCol} = $${params.length}`);
        }
      }

      if (setClauses.length === 0) {
        return reply.status(400).send({ message: "At least one field must be provided" });
      }

      if (parsed.data.setupCompleted === true) {
        setClauses.push(`setup_completed_at = now()`);
      }

      const result = await pool.query(
        `UPDATE platform.tenants SET ${setClauses.join(", ")}
         WHERE id = $1
         RETURNING id, slug, name, is_active, contact_email, address, phone, logo_url, created_at, setup_completed`,
        params,
      );

      const row = result.rows[0];
      return { ...toPublic(row), setupCompleted: row.setup_completed as boolean };
    },
  );

  // ------------------------------------------------------------------ Platform-admin-only CRUD

  app.get(
    "/tenants",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const parsed = TenantsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid query parameters" });
      }

      const { isActive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (isActive !== undefined) {
        params.push(isActive);
        conditions.push(`is_active = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countResult = await pool.query(
        `SELECT count(*)::int AS total FROM platform.tenants ${where}`,
        params,
      );

      const rows = await pool.query(
        `SELECT id, slug, name, is_active, contact_email, address, phone, logo_url, created_at
         FROM platform.tenants ${where}
         ORDER BY name
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return {
        data: rows.rows.map(toPublic),
        total: countResult.rows[0].total,
        page,
        limit,
      };
    },
  );

  /**
   * GET /tenants/:id
   */
  app.get(
    "/tenants/:id",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const uuidSchema = z.string().uuid();
      if (!uuidSchema.safeParse(id).success) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid tenant ID" });
      }

      const result = await pool.query(
        `SELECT id, slug, name, is_active, contact_email, address, phone, logo_url, created_at
         FROM platform.tenants WHERE id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, message: "Tenant not found" });
      }

      return toPublic(result.rows[0]);
    },
  );

  /**
   * POST /tenants
   */
  app.post(
    "/tenants",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const parsed = CreateTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: parsed.error.issues });
      }

      const { slug, name, contactEmail, address, phone, logoUrl, isActive } = parsed.data;

      try {
        const result = await pool.query(
          `INSERT INTO platform.tenants (slug, name, contact_email, address, phone, logo_url, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, slug, name, is_active, contact_email, address, phone, logo_url, created_at`,
          [slug, name, contactEmail ?? null, address ?? null, phone ?? null, logoUrl ?? null, isActive ?? true],
        );
        const created = result.rows[0];

        // Send verification email to contactEmail if provided
        if (contactEmail) {
          try {
            const rawToken = randomBytes(32).toString("hex");
            const tokenHash = createHash("sha256").update(rawToken).digest("hex");
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
            await pool.query(
              `INSERT INTO platform.tenant_email_verifications (tenant_id, email, token_hash, expires_at)
               VALUES ($1, $2, $3, $4)`,
              [created.id, contactEmail, tokenHash, expiresAt],
            );
            const appUrl = process.env.APP_URL ?? "http://localhost:5173";
            const verifyUrl = `${appUrl}/verify-tenant-email?token=${rawToken}`;
            const { html, text } = buildTenantVerificationEmail(name, verifyUrl);
            await sendMail({ to: contactEmail, subject: `Verify Contact Email for ${name} — AMIS`, html, text });
          } catch (emailErr) {
            console.error("[tenants] Contact email verification send failed:", emailErr);
          }
        }

        return reply.status(201).send(toPublic(created));
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply
            .status(409)
            .send({ statusCode: 409, message: "A tenant with that slug already exists" });
        }
        throw err;
      }
    },
  );

  /**
   * PUT /tenants/:id
   */
  app.put(
    "/tenants/:id",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const uuidSchema = z.string().uuid();
      if (!uuidSchema.safeParse(id).success) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid tenant ID" });
      }

      const parsed = UpdateTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: parsed.error.issues });
      }

      const fieldMap: Record<string, string> = {
        name: "name",
        contactEmail: "contact_email",
        address: "address",
        phone: "phone",
        logoUrl: "logo_url",
        isActive: "is_active",
      };

      const setClauses: string[] = [];
      const params: unknown[] = [id];

      for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
        const val = parsed.data[jsKey as keyof typeof parsed.data];
        if (val !== undefined) {
          params.push(val);
          setClauses.push(`${dbCol} = $${params.length}`);
        }
      }

      const result = await pool.query(
        `UPDATE platform.tenants SET ${setClauses.join(", ")}
         WHERE id = $1
         RETURNING id, slug, name, is_active, contact_email, address, phone, logo_url, created_at`,
        params,
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, message: "Tenant not found" });
      }

      return toPublic(result.rows[0]);
    },
  );

  /**
   * DELETE /tenants/:id  — hard-delete a tenant (platform_admin only)
   *
   * Requires the tenant to have no active users. The caller must confirm
   * intent by passing  ?confirm=true  as a query parameter, which prevents
   * accidental deletes triggered by a stray PUT/DELETE mismatch.
   */
  app.delete(
    "/tenants/:id",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const uuidSchema = z.string().uuid();
      if (!uuidSchema.safeParse(id).success) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid tenant ID" });
      }

      const { confirm, force } = req.query as { confirm?: string; force?: string };
      if (confirm !== "true") {
        return reply
          .status(400)
          .send({ statusCode: 400, message: "Pass ?confirm=true to confirm deletion" });
      }

      // Use superPool to bypass RLS on platform.users (amis_app cannot read
      // platform.users without a tenant context, which isn't set here).
      const userCount = await superPool.query(
        `SELECT count(*)::int AS cnt FROM platform.users WHERE tenant_id = $1`,
        [id],
      );
      const cnt: number = userCount.rows[0].cnt;
      if (cnt > 0 && force !== "true") {
        return reply.status(409).send({
          statusCode: 409,
          message: `Cannot delete: tenant still has ${cnt} user(s).`,
          userCount: cnt,
        });
      }

      // Delete the tenant using the superuser connection so that ON DELETE CASCADE
      // cascades correctly through RLS-protected tables (amis_app is subject to
      // RLS; without a tenant context set, cascade deletes would be blocked by the
      // RLS USING policy and cause a FK constraint violation → 500).
      //
      // app.workflow_events has an append-only BEFORE trigger that blocks DELETE.
      // We temporarily disable it (requires superuser) within a transaction so the
      // CASCADE can remove workflow_events rows belonging to this tenant.
      const client = await superPool.connect();
      let connectionDied = false;
      let result: { rows: { id: string }[] };
      try {
        await client.query("BEGIN");
        await client.query("ALTER TABLE app.workflow_events DISABLE TRIGGER ALL");
        result = await client.query(
          `DELETE FROM platform.tenants WHERE id = $1 RETURNING id`,
          [id],
        );
        await client.query("ALTER TABLE app.workflow_events ENABLE TRIGGER ALL");
        await client.query("COMMIT");
      } catch (err) {
        connectionDied = isConnectionError(err);
        if (!connectionDied) {
          await client.query("ROLLBACK").catch(() => {});
          // Best-effort re-enable in case the DISABLE succeeded but DELETE failed
          await client.query("ALTER TABLE app.workflow_events ENABLE TRIGGER ALL").catch(() => {});
        }
        throw err;
      } finally {
        client.release(connectionDied);
      }

      if (result.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, message: "Tenant not found" });
      }

      return reply.status(200).send({ message: "Tenant deleted" });
    },
  );

  /**
   * GET /tenants/verify-email?token=xxx  — public route
   * Verifies the contact email of a tenant using a token from the verification email.
   */
  app.get(
    "/tenants/verify-email",
    async (req, reply) => {
      const { token } = req.query as { token?: string };

      if (!token || typeof token !== "string" || token.length < 16) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid or missing token" });
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");

      const { rows } = await pool.query<{
        id: string;
        tenant_id: string;
        email: string;
        expires_at: string;
        used_at: string | null;
      }>(
        `SELECT id, tenant_id, email, expires_at, used_at
         FROM platform.tenant_email_verifications
         WHERE token_hash = $1`,
        [tokenHash],
      );

      if (rows.length === 0) {
        return reply.status(400).send({ statusCode: 400, message: "Invalid or expired verification link" });
      }

      const record = rows[0];

      if (record.used_at) {
        return reply.status(200).send({ message: "Email already verified" });
      }

      if (new Date(record.expires_at) < new Date()) {
        return reply.status(400).send({ statusCode: 400, message: "Verification link has expired" });
      }

      // Mark token as used and update tenant verified flag
      await pool.query(
        `UPDATE platform.tenant_email_verifications SET used_at = now() WHERE id = $1`,
        [record.id],
      );
      await pool.query(
        `UPDATE platform.tenants
         SET contact_email_verified = true, contact_email_verified_at = now()
         WHERE id = $1`,
        [record.tenant_id],
      );

      return reply.status(200).send({ message: "Email verified successfully" });
    },
  );
}
