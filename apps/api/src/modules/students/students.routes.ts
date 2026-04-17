import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  DeactivateStudentSchema,
  StudentsQuerySchema,
  type CreateStudent,
  type UpdateStudent,
  type DeactivateStudent,
} from "./students.schema.js";

const SELECT_COLS =
  "id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone, extension, " +
  "guardian_name, guardian_phone, guardian_email, guardian_relationship, " +
  "dropout_reason, dropout_date, dropout_notes, " +
  "is_active, created_at, updated_at";

export async function studentsRoutes(app: FastifyInstance) {
  const WIDE_ROLES = [
    "admin",
    "registrar",
    "hod",
    "instructor",
    "finance",
    "principal",
    "dean",
  ] as const;

  // GET /students — search + paginated list
  app.get(
    "/students",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = StudentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const { search, include_inactive, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push(`is_active = true`);
        }

        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`,
          );
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        params.push(limit, offset);
        return client.query(
          `SELECT ${SELECT_COLS} FROM app.students
           ${where}
           ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /students/:id — fetch one student
  app.get<{ Params: { id: string } }>(
    "/students/:id",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const row = await withTenant(tenantId, (client) =>
        client.query(`SELECT ${SELECT_COLS} FROM app.students WHERE id = $1`, [
          req.params.id,
        ]),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // POST /students — create (registrar, admin only)
  app.post<{ Body: CreateStudent }>(
    "/students",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = CreateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const {
        first_name,
        last_name,
        date_of_birth,
        admission_number,
        sponsorship_type,
        programme,
        email,
        phone,
        extension,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone, extension,
              guardian_name, guardian_phone, guardian_email, guardian_relationship)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING ${SELECT_COLS}`,
          [
            tenantId,
            first_name,
            last_name,
            date_of_birth ?? null,
            admission_number ?? null,
            sponsorship_type ?? null,
            programme ?? null,
            email ?? null,
            phone ?? null,
            JSON.stringify(extension ?? {}),
            guardian_name ?? null,
            guardian_phone ?? null,
            guardian_email ?? null,
            guardian_relationship ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PUT /students/:id — update (registrar, admin only)
  app.put<{ Params: { id: string }; Body: UpdateStudent }>(
    "/students/:id",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = UpdateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const {
        first_name,
        last_name,
        date_of_birth,
        admission_number,
        sponsorship_type,
        programme,
        email,
        phone,
        extension,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET
             first_name            = COALESCE($2, first_name),
             last_name             = COALESCE($3, last_name),
             date_of_birth         = COALESCE($4::date, date_of_birth),
             admission_number      = COALESCE($5, admission_number),
             sponsorship_type      = COALESCE($6, sponsorship_type),
             programme             = COALESCE($7, programme),
             email                 = COALESCE($8, email),
             phone                 = COALESCE($9, phone),
             extension             = COALESCE($10::jsonb, extension),
             guardian_name         = COALESCE($11, guardian_name),
             guardian_phone        = COALESCE($12, guardian_phone),
             guardian_email        = COALESCE($13, guardian_email),
             guardian_relationship = COALESCE($14, guardian_relationship),
             updated_at            = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [
            req.params.id,
            first_name ?? null,
            last_name ?? null,
            date_of_birth ?? null,
            admission_number ?? null,
            sponsorship_type ?? null,
            programme ?? null,
            email ?? null,
            phone ?? null,
            extension !== undefined ? JSON.stringify(extension) : null,
            guardian_name ?? null,
            guardian_phone ?? null,
            guardian_email ?? null,
            guardian_relationship ?? null,
          ],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // PATCH /students/:id/deactivate — soft-delete with optional dropout info (admin, registrar only)
  app.patch<{ Params: { id: string }; Body: DeactivateStudent }>(
    "/students/:id/deactivate",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const parsed = DeactivateStudentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const { dropout_reason, dropout_date, dropout_notes } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET is_active      = false,
               dropout_reason = COALESCE($2, dropout_reason),
               dropout_date   = COALESCE($3::date, dropout_date),
               dropout_notes  = COALESCE($4, dropout_notes),
               updated_at     = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [
            req.params.id,
            dropout_reason ?? null,
            dropout_date ?? null,
            dropout_notes ?? null,
          ],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );

  // PATCH /students/:id/reactivate — restore (admin, registrar only)
  app.patch<{ Params: { id: string } }>(
    "/students/:id/reactivate",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET is_active = true, updated_at = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );
}
