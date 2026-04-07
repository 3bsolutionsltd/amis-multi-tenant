import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  StudentsQuerySchema,
  type CreateStudent,
  type UpdateStudent,
} from "./students.schema.js";

const SELECT_COLS =
  "id, first_name, last_name, date_of_birth, extension, created_at, updated_at";

export async function studentsRoutes(app: FastifyInstance) {
  // GET /students — search + paginated list
  app.get("/students", async (req, reply) => {
    const { tenantId } = req.user;
    if (!tenantId) {
      return reply.status(400).send({ error: "x-tenant-id header required" });
    }

    const parsed = StudentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(422).send({ error: parsed.error.flatten() });
    }

    const { search, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const rows = await withTenant(tenantId, (client) => {
      if (search) {
        return client.query(
          `SELECT ${SELECT_COLS} FROM app.students
           WHERE (first_name ILIKE $1 OR last_name ILIKE $1)
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [`%${search}%`, limit, offset],
        );
      }
      return client.query(
        `SELECT ${SELECT_COLS} FROM app.students
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
    });

    return rows.rows;
  });

  // GET /students/:id — fetch one student
  app.get<{ Params: { id: string } }>("/students/:id", async (req, reply) => {
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
  });

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

      const { first_name, last_name, date_of_birth, extension } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name, date_of_birth, extension)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${SELECT_COLS}`,
          [
            tenantId,
            first_name,
            last_name,
            date_of_birth ?? null,
            JSON.stringify(extension ?? {}),
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

      const { first_name, last_name, date_of_birth, extension } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET
             first_name    = COALESCE($2, first_name),
             last_name     = COALESCE($3, last_name),
             date_of_birth = COALESCE($4::date, date_of_birth),
             extension     = COALESCE($5::jsonb, extension),
             updated_at    = now()
           WHERE id = $1
           RETURNING ${SELECT_COLS}`,
          [
            req.params.id,
            first_name ?? null,
            last_name ?? null,
            date_of_birth ?? null,
            extension !== undefined ? JSON.stringify(extension) : null,
          ],
        ),
      );

      if (row.rows.length === 0) {
        return reply.status(404).send({ error: "student not found" });
      }

      return row.rows[0];
    },
  );
}
