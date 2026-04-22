/**
 * Onboarding routes — VTI self-service registration
 *
 * POST /onboarding
 *   Public endpoint: VTI technical team registers their institute.
 *   Creates a tenant + initial admin user atomically.
 *   Returns JWT tokens for immediate login.
 *
 * POST /onboarding/provision  (platform_admin only)
 *   Platform admin provisions a new VTI (creates tenant + admin account).
 *   Returns the new tenant + a temporary password.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { hashPasswordAsync } from "../../lib/password.js";
import { signToken } from "../../lib/jwt.js";
import { requireRole } from "../../middleware/requireRole.js";
import { randomBytes } from "crypto";
import { createHash } from "crypto";

// ------------------------------------------------------------------ helpers

function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt],
  );
  return raw;
}

// ------------------------------------------------------------------ schemas

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const OnboardingSchema = z.object({
  // Institute details
  instituteName: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(SLUG_RE, "slug must be lowercase alphanumeric with hyphens"),
  contactEmail: z.string().email(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  // Initial admin account
  adminEmail: z.string().email(),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  adminName: z.string().min(1).max(255).optional(),
});

const ProvisionSchema = z.object({
  instituteName: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(SLUG_RE, "slug must be lowercase alphanumeric with hyphens"),
  contactEmail: z.string().email(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  adminEmail: z.string().email(),
  // If omitted, a random temporary password is generated
  adminPassword: z.string().min(8).max(128).optional(),
});

// ------------------------------------------------------------------ routes

export async function onboardingRoutes(app: FastifyInstance) {
  /**
   * POST /onboarding
   * Public — VTI self-registers. Creates tenant + admin user.
   * Rate-limited by the global rate limiter in buildApp.
   */
  app.post("/onboarding", async (req, reply) => {
    const parsed = OnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        message: "Validation failed",
        errors: parsed.error.issues,
      });
    }

    const { instituteName, slug, contactEmail, phone, address, adminEmail, adminPassword } =
      parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Create the tenant
      const tenantRes = await client.query(
        `INSERT INTO platform.tenants
           (slug, name, contact_email, phone, address, is_active, created_by_email, setup_completed)
         VALUES ($1, $2, $3, $4, $5, true, $6, false)
         RETURNING id`,
        [slug, instituteName, contactEmail, phone ?? null, address ?? null, contactEmail],
      );
      const tenantId: string = tenantRes.rows[0].id;

      // 2. Create the initial admin user
      const passwordHash = await hashPasswordAsync(adminPassword);
      const userRes = await client.query(
        `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)
         RETURNING id`,
        [tenantId, adminEmail, passwordHash],
      );
      const userId: string = userRes.rows[0].id;

      await client.query("COMMIT");

      // 3. Issue tokens for immediate login
      const accessToken = signToken({ sub: userId, tenantId, role: "admin" });
      const refreshToken = await issueRefreshToken(userId);

      return reply.status(201).send({
        message: "Institute registered successfully",
        userId,
        tenantId,
        tenantSlug: slug,
        adminEmail,
        accessToken,
        refreshToken,
      });
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        return reply.status(409).send({
          statusCode: 409,
          message: "An institute with that slug or email already exists",
        });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * POST /onboarding/provision  — platform_admin only
   * Provisions a new VTI tenant + admin account, returns credentials.
   * Useful when the platform team sets up a VTI on their behalf.
   */
  app.post(
    "/onboarding/provision",
    { preHandler: requireRole("platform_admin") },
    async (req, reply) => {
      const parsed = ProvisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          message: "Validation failed",
          errors: parsed.error.issues,
        });
      }

      const { instituteName, slug, contactEmail, phone, address, adminEmail } = parsed.data;

      // Generate a random temp password if none provided
      const tempPassword =
        parsed.data.adminPassword ?? randomBytes(8).toString("hex");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const tenantRes = await client.query(
          `INSERT INTO platform.tenants
             (slug, name, contact_email, phone, address, is_active, created_by_email, setup_completed)
           VALUES ($1, $2, $3, $4, $5, true, $6, false)
           RETURNING id, slug, name, contact_email`,
          [slug, instituteName, contactEmail, phone ?? null, address ?? null, contactEmail],
        );
        const tenantId: string = tenantRes.rows[0].id;

        const passwordHash = await hashPasswordAsync(tempPassword);
        await client.query(
          `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, 'admin', true)`,
          [tenantId, adminEmail, passwordHash],
        );

        await client.query("COMMIT");

        return reply.status(201).send({
          message: "VTI provisioned successfully",
          tenant: {
            id: tenantId,
            slug: tenantRes.rows[0].slug,
            name: tenantRes.rows[0].name,
            contactEmail: tenantRes.rows[0].contact_email,
          },
          adminEmail,
          // Return temp password only if we generated it (no custom one was supplied)
          temporaryPassword: parsed.data.adminPassword ? undefined : tempPassword,
          loginUrl: `/login?tenantSlug=${slug}`,
        });
      } catch (err: unknown) {
        await client.query("ROLLBACK");
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            statusCode: 409,
            message: "A tenant with that slug already exists",
          });
        }
        throw err;
      } finally {
        client.release();
      }
    },
  );
}
