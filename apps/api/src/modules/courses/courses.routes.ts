import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CoursesQuerySchema,
  CreateCourseOfferingSchema,
  UpdateCourseOfferingSchema,
  CourseOfferingsQuerySchema,
} from "./courses.schema.js";

// ------------------------------------------------------------------ constants

const WRITE_ROLES = ["registrar", "admin"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

const COURSE_COLS =
  "id, tenant_id, programme_id, code, title, credit_hours, course_type, year_of_study, semester, is_active, created_at, updated_at";

const OFFERING_COLS =
  "id, tenant_id, course_id, term_id, instructor_id, max_enrollment, created_at, updated_at";

// ------------------------------------------------------------------ routes

export async function coursesRoutes(app: FastifyInstance) {
  // ======================== Courses ========================

  // GET /courses
  app.get(
    "/courses",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CoursesQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { programme_id, search, include_inactive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push(`is_active = true`);
        }
        if (programme_id) {
          params.push(programme_id);
          conditions.push(`programme_id = $${params.length}`);
        }
        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(code ILIKE $${params.length} OR title ILIKE $${params.length})`,
          );
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${COURSE_COLS} FROM app.courses
           ${where}
           ORDER BY code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /courses/:id
  app.get<{ Params: { id: string } }>(
    "/courses/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `SELECT ${COURSE_COLS} FROM app.courses WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "course not found" });

      return row.rows[0];
    },
  );

  // POST /courses
  app.post(
    "/courses",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateCourseSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { programme_id, code, title, credit_hours, course_type, year_of_study, semester } =
        parsed.data;

      const row = await withTenant(tid, (client) =>
        client.query(
          `INSERT INTO app.courses
             (tenant_id, programme_id, code, title, credit_hours, course_type, year_of_study, semester)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING ${COURSE_COLS}`,
          [
            tid,
            programme_id,
            code,
            title,
            credit_hours ?? 3,
            course_type ?? "theory",
            year_of_study ?? 1,
            semester ?? 1,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /courses/:id
  app.patch<{ Params: { id: string } }>(
    "/courses/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateCourseSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const updates = parsed.data;
      if (Object.keys(updates).length === 0)
        return reply.status(422).send({ error: "no fields to update" });

      const fields = Object.keys(updates) as (keyof typeof updates)[];
      const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = fields.map((k) => updates[k]);

      const row = await withTenant(tid, (client) =>
        client.query(
          `UPDATE app.courses
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${COURSE_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "course not found" });

      return row.rows[0];
    },
  );

  // DELETE /courses/:id (soft delete)
  app.delete<{ Params: { id: string } }>(
    "/courses/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tid, (client) =>
        client.query(
          `UPDATE app.courses
           SET is_active = false, updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "course not found" });

      return reply.status(204).send();
    },
  );

  // ======================== Course Offerings ========================

  // GET /course-offerings
  app.get(
    "/course-offerings",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CourseOfferingsQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { course_id, term_id, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (course_id) {
          params.push(course_id);
          conditions.push(`co.course_id = $${params.length}`);
        }
        if (term_id) {
          params.push(term_id);
          conditions.push(`co.term_id = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT co.id, co.tenant_id, co.course_id, co.term_id, co.instructor_id,
                  co.max_enrollment, co.created_at, co.updated_at,
                  c.code AS course_code, c.title AS course_title,
                  t.name AS term_name
           FROM app.course_offerings co
           LEFT JOIN app.courses c ON c.id = co.course_id
           LEFT JOIN app.terms t ON t.id = co.term_id
           ${where}
           ORDER BY co.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // POST /course-offerings
  app.post(
    "/course-offerings",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateCourseOfferingSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { course_id, term_id, instructor_id, max_enrollment } = parsed.data;

      const row = await withTenant(tid, (client) =>
        client.query(
          `INSERT INTO app.course_offerings
             (tenant_id, course_id, term_id, instructor_id, max_enrollment)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${OFFERING_COLS}`,
          [tid, course_id, term_id, instructor_id ?? null, max_enrollment ?? null],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /course-offerings/:id
  app.patch<{ Params: { id: string } }>(
    "/course-offerings/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateCourseOfferingSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const updates = parsed.data;
      if (Object.keys(updates).length === 0)
        return reply.status(422).send({ error: "no fields to update" });

      const fields = Object.keys(updates) as (keyof typeof updates)[];
      const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = fields.map((k) => updates[k]);

      const row = await withTenant(tid, (client) =>
        client.query(
          `UPDATE app.course_offerings
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${OFFERING_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "course offering not found" });

      return row.rows[0];
    },
  );
}
