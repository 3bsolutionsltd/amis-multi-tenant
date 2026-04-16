import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/devIdentity.js";
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  StaffQuerySchema,
  CreateContractSchema,
  CreateAttendanceSchema,
  CreateAppraisalSchema,
} from "./staff.schema.js";

const STAFF_COLS =
  "id, staff_number, first_name, last_name, email, phone, department, designation, employment_type, join_date, salary, is_active, notes, created_at, updated_at";

const CONTRACT_COLS =
  "id, staff_id, contract_type, start_date, end_date, salary, notes, created_at";

const ATTENDANCE_COLS =
  "id, staff_id, attendance_date, session, status, notes, created_at";

const APPRAISAL_COLS =
  "id, staff_id, period, rating, comments, appraised_by, appraised_at, created_at";

const ADMIN_ROLES = ["admin"] as const;

const HR_ROLES = ["admin", "registrar", "hod", "principal"] as const;

const WRITE_ROLES = ["admin", "registrar", "hod", "principal"] as const;

const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

export async function staffRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------ profiles

  // GET /staff — list profiles
  app.get(
    "/staff",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = StaffQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { search, department, employment_type, include_inactive, page, limit } =
        parsed.data;
      const offset = (page - 1) * limit;

      const rows = await withTenant(tenantId, (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!include_inactive) {
          conditions.push("is_active = true");
        }
        if (department) {
          params.push(department);
          conditions.push(`department = $${params.length}`);
        }
        if (employment_type) {
          params.push(employment_type);
          conditions.push(`employment_type = $${params.length}`);
        }
        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length} OR staff_number ILIKE $${params.length})`,
          );
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit, offset);

        return client.query(
          `SELECT ${STAFF_COLS} FROM app.staff_profiles
           ${where}
           ORDER BY last_name ASC, first_name ASC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // GET /staff/:id — single profile
  app.get<{ Params: { id: string } }>(
    "/staff/:id",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${STAFF_COLS} FROM app.staff_profiles WHERE id = $1`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "staff not found" });

      return row.rows[0];
    },
  );

  // POST /staff — create
  app.post(
    "/staff",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateStaffSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const {
        staff_number,
        first_name,
        last_name,
        email,
        phone,
        department,
        designation,
        employment_type,
        join_date,
        salary,
        notes,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.staff_profiles
             (tenant_id, staff_number, first_name, last_name, email, phone,
              department, designation, employment_type, join_date, salary, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING ${STAFF_COLS}`,
          [
            tenantId,
            staff_number ?? null,
            first_name,
            last_name,
            email ?? null,
            phone ?? null,
            department ?? null,
            designation ?? null,
            employment_type ?? null,
            join_date ?? null,
            salary ?? null,
            notes ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // PATCH /staff/:id — update
  app.patch<{ Params: { id: string } }>(
    "/staff/:id",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = UpdateStaffSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const data = parsed.data;
      const fields = (Object.keys(data) as (keyof typeof data)[]).filter(
        (k) => data[k] !== undefined,
      );
      if (fields.length === 0)
        return reply.status(422).send({ error: "No fields to update" });

      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
      const values = fields.map((f) => data[f]);

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.staff_profiles
           SET ${setClauses}, updated_at = now()
           WHERE id = $1
           RETURNING ${STAFF_COLS}`,
          [req.params.id, ...values],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "staff not found" });

      return row.rows[0];
    },
  );

  // DELETE /staff/:id — soft-delete
  app.delete<{ Params: { id: string } }>(
    "/staff/:id",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.staff_profiles
           SET is_active = false, updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [req.params.id],
        ),
      );

      if (row.rows.length === 0)
        return reply.status(404).send({ error: "staff not found" });

      return reply.status(204).send();
    },
  );

  // ----------------------------------------------------------------- contracts

  // GET /staff/:id/contracts
  app.get<{ Params: { id: string } }>(
    "/staff/:id/contracts",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const rows = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${CONTRACT_COLS} FROM app.staff_contracts
           WHERE staff_id = $1
           ORDER BY start_date DESC`,
          [req.params.id],
        ),
      );

      return rows.rows;
    },
  );

  // POST /staff/:id/contracts
  app.post<{ Params: { id: string } }>(
    "/staff/:id/contracts",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateContractSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { contract_type, start_date, end_date, salary, notes } =
        parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.staff_contracts
             (tenant_id, staff_id, contract_type, start_date, end_date, salary, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING ${CONTRACT_COLS}`,
          [
            tenantId,
            req.params.id,
            contract_type,
            start_date,
            end_date ?? null,
            salary ?? null,
            notes ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // ---------------------------------------------------------------- attendance

  // GET /staff/:id/attendance
  app.get<{ Params: { id: string } }>(
    "/staff/:id/attendance",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const rows = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${ATTENDANCE_COLS} FROM app.staff_attendance
           WHERE staff_id = $1
           ORDER BY attendance_date DESC, session ASC`,
          [req.params.id],
        ),
      );

      return rows.rows;
    },
  );

  // POST /staff/:id/attendance
  app.post<{ Params: { id: string } }>(
    "/staff/:id/attendance",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateAttendanceSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { attendance_date, session, status, notes } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.staff_attendance
             (tenant_id, staff_id, attendance_date, session, status, notes)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (tenant_id, staff_id, attendance_date, session)
             DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
           RETURNING ${ATTENDANCE_COLS}`,
          [
            tenantId,
            req.params.id,
            attendance_date,
            session,
            status,
            notes ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );

  // ---------------------------------------------------------------- appraisals

  // GET /staff/:id/appraisals
  app.get<{ Params: { id: string } }>(
    "/staff/:id/appraisals",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const rows = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${APPRAISAL_COLS} FROM app.staff_appraisals
           WHERE staff_id = $1
           ORDER BY created_at DESC`,
          [req.params.id],
        ),
      );

      return rows.rows;
    },
  );

  // POST /staff/:id/appraisals
  app.post<{ Params: { id: string } }>(
    "/staff/:id/appraisals",
    { preHandler: requireRole(...HR_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateAppraisalSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { period, rating, comments, appraised_by } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.staff_appraisals
             (tenant_id, staff_id, period, rating, comments, appraised_by)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING ${APPRAISAL_COLS}`,
          [
            tenantId,
            req.params.id,
            period,
            rating ?? null,
            comments ?? null,
            appraised_by ?? null,
          ],
        ),
      );

      return reply.status(201).send(row.rows[0]);
    },
  );
}
