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
import { pool, superPool } from "../../db/pool.js";
import { hashPasswordAsync } from "../../lib/password.js";
import { signToken } from "../../lib/jwt.js";
import { requireRole } from "../../middleware/requireRole.js";
import { randomBytes, createHash } from "crypto";
import { sendMail, buildTenantVerificationEmail, buildWelcomeEmail } from "../../lib/email.js";

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

const OWNERSHIP_TYPES = ["public", "private", "faith_based", "community"] as const;
const LICENSE_STATUSES = ["active", "pending", "expired", "suspended"] as const;

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
  // TVET / CoVE compliance fields
  ownershipType: z.enum(OWNERSHIP_TYPES),
  uvtabCentreCode: z.string().max(30).optional(),
  licenseNumber: z.string().max(100).optional(),
  licenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().or(z.literal("")),
  licenseStatus: z.enum(LICENSE_STATUSES).optional().default("active"),
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
   * Disabled unless ENABLE_PUBLIC_ONBOARDING=true (default: off).
   * VTIs must be provisioned by platform admin via POST /onboarding/provision.
   * When enabled, creates a tenant + admin user and returns JWT tokens.
   */
  app.post("/onboarding", async (req, reply) => {
    if (process.env.ENABLE_PUBLIC_ONBOARDING !== "true") {
      return reply.status(403).send({
        statusCode: 403,
        message:
          "Public self-registration is disabled. Contact your platform administrator.",
      });
    }

    const parsed = OnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        message: "Validation failed",
        errors: parsed.error.issues,
      });
    }

    const {
      instituteName, slug, contactEmail, phone, address,
      ownershipType, uvtabCentreCode, licenseNumber, licenseDate, licenseStatus,
      adminEmail, adminPassword,
    } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Create the tenant
      const tenantRes = await client.query(
        `INSERT INTO platform.tenants
           (slug, name, contact_email, phone, address, is_active, created_by_email, setup_completed,
            ownership_type, uvtab_centre_code, license_number, license_date, license_status)
         VALUES ($1, $2, $3, $4, $5, true, $6, false, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          slug, instituteName, contactEmail, phone ?? null, address ?? null, contactEmail,
          ownershipType,
          uvtabCentreCode || null,
          licenseNumber || null,
          licenseDate || null,
          licenseStatus ?? "active",
        ],
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

      // 3. Pre-load Uganda TVET standard 2025/2026 academic calendar
      //    Must set RLS context (app.tenant_id) before inserting into app schema tables.
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      const yearRes = await client.query(
        `INSERT INTO app.academic_years (tenant_id, name, start_date, end_date, is_current)
         VALUES ($1, '2025/2026', '2026-01-27', '2026-11-28', true)
         RETURNING id`,
        [tenantId],
      );
      const academicYearId: string = yearRes.rows[0].id;

      const tvetTerms = [
        { name: "Term 1", term_number: 1, start_date: "2026-02-03", end_date: "2026-04-18", is_current: false },
        { name: "Term 2", term_number: 2, start_date: "2026-05-05", end_date: "2026-08-21", is_current: true },
        { name: "Term 3", term_number: 3, start_date: "2026-09-07", end_date: "2026-11-27", is_current: false },
      ];
      for (const t of tvetTerms) {
        await client.query(
          `INSERT INTO app.terms (tenant_id, academic_year_id, name, term_number, start_date, end_date, is_current)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, academicYearId, t.name, t.term_number, t.start_date, t.end_date, t.is_current],
        );
      }

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

      // Use superPool: platform.users has RLS (users_tenant_isolation) that
      // blocks INSERT when app.tenant_id is not set. Provisioning is a
      // platform-admin operation so the superuser connection is correct.
      const client = await superPool.connect();
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
        const userRes = await client.query(
          `INSERT INTO platform.users (tenant_id, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, 'admin', true)
           RETURNING id`,
          [tenantId, adminEmail, passwordHash],
        );
        const userId: string = userRes.rows[0].id;

        await client.query("COMMIT");

        // Send contact email verification (outside transaction — non-fatal if it fails)
        try {
          const verifyToken = randomBytes(32).toString("hex");
          const verifyHash = createHash("sha256").update(verifyToken).digest("hex");
          const verifyExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 h
          await superPool.query(
            `INSERT INTO platform.tenant_email_verifications (tenant_id, email, token_hash, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [tenantId, contactEmail, verifyHash, verifyExpiry],
          );
          const appUrl = process.env.APP_URL ?? "http://localhost:5173";
          const verifyUrl = `${appUrl}/verify-tenant-email?token=${verifyToken}`;
          const { html, text } = buildTenantVerificationEmail(instituteName, verifyUrl);
          await sendMail({
            to: contactEmail,
            subject: `Verify Contact Email for ${instituteName} — AMIS`,
            html,
            text,
          });
        } catch (emailErr) {
          console.error("[onboarding] Contact email verification send failed:", emailErr);
        }

        // Send welcome / account-setup email to the admin user
        try {
          const setupToken = randomBytes(32).toString("hex");
          const setupHash = createHash("sha256").update(setupToken).digest("hex");
          const setupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 h
          await superPool.query(
            `INSERT INTO platform.password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userId, setupHash, setupExpiry],
          );
          const appUrl = process.env.APP_URL ?? "http://localhost:5173";
          const setupUrl = `${appUrl}/reset-password?token=${setupToken}&mode=setup`;
          const { html, text } = buildWelcomeEmail(setupUrl, null);
          await sendMail({
            to: adminEmail,
            subject: "Welcome to AMIS — Set Up Your Account",
            html,
            text,
          });
        } catch (emailErr) {
          console.error("[onboarding] Welcome email send failed:", emailErr);
        }

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
