import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
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
  "id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone, " +
  "year_of_study, class_section, extension, " +
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

      const { search, include_inactive, year_of_study, class_section, programme, page, limit } = parsed.data;
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
            `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR admission_number ILIKE $${params.length})`,
          );
        }

        if (year_of_study) {
          params.push(year_of_study);
          conditions.push(`year_of_study = $${params.length}`);
        }

        if (class_section) {
          params.push(class_section);
          conditions.push(`class_section = $${params.length}`);
        }

        if (programme) {
          params.push(programme);
          conditions.push(`programme = $${params.length}`);
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

  // GET /students/:id — 360° student view (SR-F-008)
  app.get<{ Params: { id: string } }>(
    "/students/:id",
    { preHandler: requireRole(...WIDE_ROLES) },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const result = await withTenant(tenantId, async (client) => {
        // Core student record
        const { rows: stuRows } = await client.query(
          `SELECT ${SELECT_COLS} FROM app.students WHERE id = $1`,
          [req.params.id],
        );
        if (stuRows.length === 0) return null;

        const student = stuRows[0];
        const sid = req.params.id;

        // Marks summary — latest marks per submission
        const { rows: marks } = await client.query(
          `SELECT ms.course_id, ms.term, ms.intake, me.score,
                  wi.current_state AS submission_state
           FROM app.mark_entries me
           JOIN app.mark_submissions ms ON ms.id = me.submission_id
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'marks' AND wi.entity_id = ms.id
           WHERE me.student_id = $1
           ORDER BY ms.term DESC, ms.course_id`,
          [sid],
        );

        // Admissions history
        const { rows: admissions } = await client.query(
          `SELECT a.id, a.programme, a.intake,
                  wi.current_state
           FROM app.admission_applications a
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'admissions' AND wi.entity_id = a.id
           WHERE a.tenant_id = $1
             AND a.first_name = $2 AND a.last_name = $3
           ORDER BY a.created_at DESC`,
          [tenantId, student.first_name, student.last_name],
        );

        // Term registrations
        const { rows: termRegs } = await client.query(
          `SELECT r.id, r.academic_year, r.term, r.created_at,
                  wi.current_state
           FROM app.term_registrations r
           LEFT JOIN app.workflow_instances wi
             ON wi.entity_type = 'term_registration' AND wi.entity_id = r.id
           WHERE r.student_id = $1
           ORDER BY r.created_at DESC`,
          [sid],
        );

        // Industrial training
        const { rows: itRecords } = await client.query(
          `SELECT id, company, status, start_date, end_date
           FROM app.industrial_training
           WHERE student_id = $1
           ORDER BY start_date DESC`,
          [sid],
        );

        // Field placements
        const { rows: fpRecords } = await client.query(
          `SELECT id, host_organisation, status, start_date, end_date
           FROM app.field_placements
           WHERE student_id = $1
           ORDER BY start_date DESC`,
          [sid],
        );

        // Fee summary
        const { rows: feeRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid, MAX(paid_at) AS last_payment
           FROM app.payments WHERE student_id = $1`,
          [sid],
        );

        return {
          ...student,
          marks,
          admissions,
          term_registrations: termRegs,
          industrial_training: itRecords,
          field_placements: fpRecords,
          fees: {
            total_paid: Number(feeRows[0]?.total_paid ?? 0),
            last_payment: feeRows[0]?.last_payment ?? null,
          },
        };
      });

      if (!result) {
        return reply.status(404).send({ error: "student not found" });
      }

      return result;
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
        year_of_study,
        class_section,
        extension,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
      } = parsed.data;

      const row = await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO app.students
             (tenant_id, first_name, last_name, date_of_birth, admission_number, sponsorship_type, programme, email, phone,
              year_of_study, class_section, extension,
              guardian_name, guardian_phone, guardian_email, guardian_relationship)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
            year_of_study ?? null,
            class_section ?? null,
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
        programme_id,
        email,
        phone,
        year_of_study,
        class_section,
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
             programme_id          = COALESCE($8::uuid, programme_id),
             email                 = COALESCE($9, email),
             phone                 = COALESCE($10, phone),
             year_of_study         = COALESCE($11::smallint, year_of_study),
             class_section         = COALESCE($12, class_section),
             extension             = COALESCE($13::jsonb, extension),
             guardian_name         = COALESCE($14, guardian_name),
             guardian_phone        = COALESCE($15, guardian_phone),
             guardian_email        = COALESCE($16, guardian_email),
             guardian_relationship = COALESCE($17, guardian_relationship),
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
            programme_id ?? null,
            email ?? null,
            phone ?? null,
            year_of_study ?? null,
            class_section ?? null,
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

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /students/export/csv — SR-F-005 CSV export
  // ─────────────────────────────────────────────────────────────────────────────
  app.get(
    "/students/export/csv",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const rows = await withTenant(tenantId, (client) =>
        client.query(
          `SELECT ${SELECT_COLS} FROM app.students
           WHERE tenant_id = $1
           ORDER BY last_name, first_name`,
          [tenantId],
        ),
      );

      const CSV_COLS = [
        "id",
        "first_name",
        "last_name",
        "date_of_birth",
        "admission_number",
        "sponsorship_type",
        "programme",
        "email",
        "phone",
        "guardian_name",
        "guardian_phone",
        "guardian_email",
        "guardian_relationship",
        "is_active",
        "dropout_reason",
        "dropout_date",
        "created_at",
      ];

      const escapeCsv = (v: unknown): string => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const header = CSV_COLS.join(",");
      const body = rows.rows
        .map((r: Record<string, unknown>) =>
          CSV_COLS.map((c) => escapeCsv(r[c])).join(","),
        )
        .join("\n");

      const csv = `${header}\n${body}`;

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="students-export.csv"',
        )
        .send(csv);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /students/promote — bulk increment year_of_study for a cohort (admin/registrar)
  // Body: { programme?, from_year: number, to_year: number, class_section? }
  //   Increments year_of_study by 1 for all active students matching the filters,
  //   capped at 6. Returns affected count.
  // ─────────────────────────────────────────────────────────────────────────────
  app.post(
    "/students/promote",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const body = req.body as {
        programme?: string;
        from_year?: number;
        class_section?: string;
      };

      const conditions: string[] = ["tenant_id = $1", "is_active = true", "year_of_study < 6"];
      const params: unknown[] = [tenantId];

      if (body.programme) {
        params.push(body.programme);
        conditions.push(`programme = $${params.length}`);
      }
      if (body.from_year != null) {
        params.push(Number(body.from_year));
        conditions.push(`year_of_study = $${params.length}`);
      }
      if (body.class_section) {
        params.push(body.class_section);
        conditions.push(`class_section = $${params.length}`);
      }

      const result = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET year_of_study = year_of_study + 1, updated_at = now()
           WHERE ${conditions.join(" AND ")}`,
          params,
        ),
      );

      return { promoted: result.rowCount ?? 0 };
    },
  );

  // POST /students/demote — bulk decrement year_of_study for a cohort (admin/registrar)
  app.post(
    "/students/demote",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const body = req.body as {
        programme?: string;
        from_year?: number;
        class_section?: string;
      };

      const conditions: string[] = ["tenant_id = $1", "is_active = true", "year_of_study > 1"];
      const params: unknown[] = [tenantId];

      if (body.programme) {
        params.push(body.programme);
        conditions.push(`programme = $${params.length}`);
      }
      if (body.from_year != null) {
        params.push(Number(body.from_year));
        conditions.push(`year_of_study = $${params.length}`);
      }
      if (body.class_section) {
        params.push(body.class_section);
        conditions.push(`class_section = $${params.length}`);
      }

      const result = await withTenant(tenantId, (client) =>
        client.query(
          `UPDATE app.students
           SET year_of_study = year_of_study - 1, updated_at = now()
           WHERE ${conditions.join(" AND ")}`,
          params,
        ),
      );

      return { demoted: result.rowCount ?? 0 };
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /students/import — bulk create students from CSV rows (admin/registrar)
  // Body: { rows: object[] }
  //   Each row is a flat object with keys matching CSV headers (see mapping below).
  //   Returns { imported, skipped, errors[] }.
  // ─────────────────────────────────────────────────────────────────────────────
  app.post(
    "/students/import",
    { preHandler: requireRole("admin", "registrar") },
    async (req, reply) => {
      const { tenantId } = req.user;
      if (!tenantId) {
        return reply.status(400).send({ error: "x-tenant-id header required" });
      }

      const RowsSchema = z.object({
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
      });
      const parsed = RowsSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const { rows } = parsed.data;

      // Column name aliases: CSV header → internal key
      const COL = (row: Record<string, unknown>, ...keys: string[]): string => {
        for (const k of keys) {
          const v = row[k];
          if (v != null && String(v).trim() !== "") return String(v).trim();
        }
        return "";
      };

      let imported = 0;
      let skipped = 0;
      const errors: { row: number; error: string }[] = [];
      const warnings: { row: number; student_id: string; student_name: string; raw_programme: string }[] = [];

      await withTenant(tenantId, async (client) => {
        // Build a case-insensitive lookup: code/title → { id, title }
        const { rows: progRows } = await client.query<{ id: string; code: string; title: string }>(
          `SELECT id, code, title FROM app.programmes WHERE is_active = true`,
        );
        const progByKey = new Map<string, { id: string; title: string }>();
        for (const p of progRows) {
          progByKey.set(p.code.toLowerCase().trim(), { id: p.id, title: p.title });
          progByKey.set(p.title.toLowerCase().trim(), { id: p.id, title: p.title });
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as Record<string, unknown>;

          let firstName = COL(row, "First Name", "first_name", "FirstName");
          let lastName  = COL(row, "Last Name", "Last name", "last_name", "LastName");

          // Auto-split when all names are packed into the first-name cell
          // e.g. firstName="John Paul Mwesigwa", lastName="" → first="John", last="Mwesigwa", other="Paul"
          // e.g. firstName="NAKAMYA", lastName="" (single name) → first="NAKAMYA", last="NAKAMYA"
          let autoOtherName = "";
          if (firstName && !lastName) {
            const parts = firstName.trim().split(/\s+/);
            if (parts.length >= 2) {
              firstName     = parts[0];
              lastName      = parts[parts.length - 1];
              autoOtherName = parts.slice(1, -1).join(" "); // middle word(s)
            } else {
              // Single-word name: use it as both first and last (common for single-name students)
              lastName = firstName;
            }
          }
          // Reverse case: only last name found
          if (lastName && !firstName) {
            firstName = lastName;
          }

          if (!firstName || !lastName) {
            errors.push({ row: i + 2, error: "first_name and last_name are required" });
            skipped++;
            continue;
          }

          const admissionNumber = COL(row, "Student Reg.Number", "Student Reg. Number", "admission_number", "Reg No", "RegNo");
          const otherName       = COL(row, "Other Name", "Other name", "other_name") || autoOtherName;
          const gender          = COL(row, "Gender", "gender");
          const dobRaw          = COL(row, "Date of Birth", "Date Of Birth", "date_of_birth", "DOB");
          const nationalId      = COL(row, "National ID/NIN", "National ID", "NIN", "national_id");
          const phone           = COL(row, "phone number", "Phone Number", "phone", "Phone");
          const email           = COL(row, "EMAIL", "Email", "email");
          const district        = COL(row, "District of Orign", "District of Origin", "district_of_origin");
          const nokName         = COL(row, "Next of kin Name", "Next of Kin Name", "guardian_name");
          const nokPhone        = COL(row, "Next of kin phone", "Next of Kin Phone", "guardian_phone");
          const programme       = COL(row, "Programme", "programme");
          // Resolve programme text → programme_id (case-insensitive, code or title)
          const progMatch = programme ? progByKey.get(programme.toLowerCase().trim()) : undefined;
          const resolvedProgrammeId   = progMatch?.id ?? null;
          const resolvedProgrammeText = progMatch?.title ?? (programme || null);
          const intakeYear      = COL(row, "Intake Year", "intake_year", "Intake");
          const enrolledRaw     = COL(row, "Enrolled status", "Enrolled Status", "enrolled_status", "is_active");
          const sponsorship     = COL(row, "sponsorship", "Sponsorship", "sponsorship_type");

          // Normalise date
          let dob: string | null = null;
          if (dobRaw) {
            // Accept DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD
            const slashMatch = dobRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (slashMatch) {
              dob = `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
              dob = dobRaw;
            }
          }

          // Normalise is_active
          const isActive =
            enrolledRaw === "" || /^(yes|active|enrolled|true|1)$/i.test(enrolledRaw);

          // Build extension JSONB for unmapped fields
          const extension: Record<string, string> = {};
          if (otherName)  extension["other_name"]         = otherName;
          if (gender)     extension["gender"]              = gender;
          if (nationalId) extension["national_id"]         = nationalId;
          if (district)   extension["district_of_origin"]  = district;
          if (intakeYear) extension["intake_year"]         = intakeYear;

          // Use a SAVEPOINT so a failed INSERT can be rolled back without
          // aborting the outer transaction (PostgreSQL "transaction is aborted" cascade).
          const sp = `sp_import_${i}`;
          try {
            await client.query(`SAVEPOINT ${sp}`);
            const { rows: insRows } = await client.query<{ id: string }>(
              `INSERT INTO app.students
                 (tenant_id, first_name, last_name, date_of_birth, admission_number,
                  sponsorship_type, programme, programme_id, email, phone,
                  guardian_name, guardian_phone, extension, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
               RETURNING id`,
              [
                tenantId,
                firstName,
                lastName,
                dob,
                admissionNumber || null,
                sponsorship || null,
                resolvedProgrammeText,
                resolvedProgrammeId,
                email || null,
                phone || null,
                nokName || null,
                nokPhone || null,
                JSON.stringify(extension),
                isActive,
              ],
            );
            await client.query(`RELEASE SAVEPOINT ${sp}`);
            imported++;
            if (programme && !resolvedProgrammeId) {
              warnings.push({
                row: i + 2,
                student_id: insRows[0].id,
                student_name: `${firstName} ${lastName}`,
                raw_programme: programme,
              });
            }
          } catch (err: unknown) {
            await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
            const pgErr = err as { code?: string; detail?: string };
            if (pgErr.code === "23505") {
              skipped++;
              errors.push({ row: i + 2, error: `Duplicate record (${pgErr.detail ?? "unique constraint"})` });
            } else {
              skipped++;
              errors.push({ row: i + 2, error: pgErr.detail ?? String(err) });
            }
          }
        }
      });

      return reply.status(201).send({ imported, skipped, errors, warnings });
    },
  );
}

