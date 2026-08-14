import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  SignOffSchema,
  ClearanceQuerySchema,
  DEPARTMENTS,
  DEPT_STEP,
  CLEARANCE_STEPS,
} from "./clearance.schema.js";

// ---------------------------------------------------------------------------
// Shared eligibility helper (used by GET /eligibility and POST /sign-off)
// ---------------------------------------------------------------------------

interface EligibilityCheck {
  pass: boolean;
  detail: string;
}

export interface EligibilityResult {
  student_id: string;
  term_id: string;
  checks: {
    registered: EligibilityCheck;
    fees_cleared: EligibilityCheck;
    marks_complete: EligibilityCheck;
    attendance_ok: EligibilityCheck;
  };
  eligible: boolean;
}

async function computeEligibility(
  client: PoolClient,
  studentId: string,
  termId: string,
): Promise<EligibilityResult | { notFound: true } | { termNotFound: true }> {
  // 1. Verify student exists and get programme_id
  const { rows: stuRows } = await client.query<{
    id: string;
    programme_id: string | null;
    programme: string | null;
    programme_code: string | null;
    sponsorship_type: string | null;
  }>(
    `SELECT id, programme_id, programme, programme_code, sponsorship_type
     FROM app.students WHERE id = $1`,
    [studentId],
  );
  if (!stuRows[0]) return { notFound: true };
  const student = stuRows[0];

  // 2. Look up term + academic year names
  const { rows: termRows } = await client.query<{
    term_name: string;
    term_number: number;
    academic_year_id: string;
    academic_year_name: string;
  }>(
    `SELECT t.name AS term_name, t.term_number, t.academic_year_id,
            ay.name AS academic_year_name
     FROM app.terms t
     JOIN app.academic_years ay ON ay.id = t.academic_year_id
     WHERE t.id = $1`,
    [termId],
  );
  if (!termRows[0]) return { termNotFound: true };
  const term = termRows[0];

  // 3. Registration check (term_registrations uses text labels)
  const { rows: regRows } = await client.query(
    `SELECT id FROM app.term_registrations
     WHERE student_id = $1 AND academic_year = $2 AND term = $3`,
    [studentId, term.academic_year_name, term.term_name],
  );
  const registered = regRows.length > 0;

  // 4. Fees check: total fee structure due vs. total payments received
  let feesDue = 0;
  let feesPaid = 0;
  if (student.programme_id) {
    const { rows: feeRows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(fs.amount), 0) AS total
       FROM app.fee_structures fs
       JOIN app.programmes p ON p.id = fs.programme_id
       LEFT JOIN app.terms fee_term ON fee_term.id = fs.term_id
       WHERE fs.academic_year_id = $1
         AND fs.is_active = true
         AND (fs.term_id IS NULL OR fee_term.id = $2)
         AND fs.student_category = ANY(
           CASE
             WHEN LOWER($3) LIKE '%boarding%' OR LOWER($3) LIKE '%boarder%'
               THEN ARRAY['all', 'boarding']::text[]
             WHEN LOWER($3) LIKE '%day%'
               OR (NULLIF(TRIM($3), '') IS NOT NULL)
               THEN ARRAY['all', 'day']::text[]
             ELSE ARRAY['all']::text[]
           END
         )
         AND (
           fs.programme_id = $4::uuid
           OR LOWER(p.code) = LOWER(COALESCE($5, ''))
           OR LOWER(p.title) = LOWER(COALESCE($6, ''))
         )`,
      [term.academic_year_id, termId, student.sponsorship_type ?? "", student.programme_id, student.programme_code, student.programme],
    );
    feesDue = parseFloat(feeRows[0]?.total ?? "0");

    const { rows: payRows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM app.payments
       WHERE student_id = $1`,
      [studentId],
    );
    feesPaid = parseFloat(payRows[0]?.total ?? "0");
  }
  const feesCleared = feesDue === 0 || feesPaid >= feesDue;

  // 5. Marks check: at least one mark entry for this student in this term
  const { rows: markRows } = await client.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt
     FROM app.mark_entries me
     JOIN app.mark_submissions ms ON ms.id = me.submission_id
     WHERE me.student_id = $1 AND ms.term = $2`,
    [studentId, term.term_name],
  );
  const marksCount = parseInt(markRows[0]?.cnt ?? "0", 10);
  const marksComplete = marksCount > 0;

  // 6. Attendance check (minimum 75% attendance rate for the term)
  const MIN_ATTENDANCE_PCT = 75;
  const { rows: attRows } = await client.query<{ attended: string; total: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('present', 'late')) AS attended,
       COUNT(*) AS total
     FROM app.attendance
     WHERE student_id = $1 AND academic_year = $2 AND term_number = $3`,
    [studentId, term.academic_year_name, term.term_number],
  );
  const totalSessions = parseInt(attRows[0]?.total ?? "0", 10);
  const attendedSessions = parseInt(attRows[0]?.attended ?? "0", 10);
  const attendanceRate =
    totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;
  // Waive the check if no attendance records exist for this term
  const attendanceOk = totalSessions === 0 || attendanceRate >= MIN_ATTENDANCE_PCT;

  return {
    student_id: studentId,
    term_id: termId,
    checks: {
      registered: {
        pass: registered,
        detail: registered
          ? `Registered for ${term.term_name} ${term.academic_year_name}`
          : `Not registered for ${term.term_name} ${term.academic_year_name}`,
      },
      fees_cleared: {
        pass: feesCleared,
        detail: `Paid UGX ${Math.round(feesPaid).toLocaleString()} of UGX ${Math.round(feesDue).toLocaleString()} due`,
      },
      marks_complete: {
        pass: marksComplete,
        detail: marksComplete
          ? `${marksCount} course mark ${marksCount === 1 ? "entry" : "entries"} found`
          : "No mark entries found for this term",
      },
      attendance_ok: {
        pass: attendanceOk,
        detail:
          totalSessions === 0
            ? "No attendance records found (check waived)"
            : `${attendanceRate}% attendance (${attendedSessions}/${totalSessions} sessions; minimum ${MIN_ATTENDANCE_PCT}%)`,
      },
    },
    eligible: registered && feesCleared && marksComplete && attendanceOk,
  };
}

export async function clearanceRoutes(app: FastifyInstance) {
  // ---------- GET /clearance — list sign-offs (with optional filters)
  app.get(
    "/clearance",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "principal",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = ClearanceQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, term_id, department, status } = parsed.data;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [tid];

        if (student_id) {
          params.push(student_id);
          conditions.push(`c.student_id = $${params.length}`);
        }
        if (term_id) {
          params.push(term_id);
          conditions.push(`c.term_id = $${params.length}`);
        }
        if (department) {
          params.push(department);
          conditions.push(`c.department = $${params.length}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`c.status = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        return client.query(
          `SELECT c.*, s.first_name, s.last_name, s.admission_number
           FROM app.clearance_signoffs c
           LEFT JOIN app.students s ON s.id = c.student_id
           WHERE c.tenant_id = $1 ${where}
           ORDER BY c.created_at DESC`,
          params,
        );
      });

      return rows.rows;
    },
  );

  // ---------- GET /clearance/eligibility/:studentId?term_id= — prerequisite checklist
  app.get<{
    Params: { studentId: string };
    Querystring: { term_id?: string };
  }>(
    "/clearance/eligibility/:studentId",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "principal",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId } = req.params;
      const { term_id: termId } = req.query;
      if (!termId)
        return reply
          .status(422)
          .send({ error: "term_id query parameter required" });

      const result = await withTenant(tid, async (client) =>
        computeEligibility(client, studentId, termId),
      );

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });
      if ("termNotFound" in result)
        return reply.status(404).send({ error: "term not found" });

      return result;
    },
  );

  // ---------- GET /clearance/student/:studentId/term/:termId — full clearance status for one student + term
  app.get<{ Params: { studentId: string; termId: string } }>(
    "/clearance/student/:studentId/term/:termId",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "principal",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId, termId } = req.params;

      const result = await withTenant(tid, async (client) => {
        const { rows: existing } = await client.query(
          `SELECT department, status, signed_by, signed_at, remarks
           FROM app.clearance_signoffs
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
          [tid, studentId, termId],
        );

        // Build map of all 8 departments with their status
        const signoffs: Record<
          string,
          { status: string; signed_by: string | null; signed_at: string | null; remarks: string | null }
        > = {};
        for (const dept of DEPARTMENTS) {
          const row = existing.find((r: { department: string }) => r.department === dept);
          signoffs[dept] = row
            ? {
                status: row.status,
                signed_by: row.signed_by,
                signed_at: row.signed_at,
                remarks: row.remarks,
              }
            : { status: "PENDING", signed_by: null, signed_at: null, remarks: null };
        }

        const completedCount = Object.values(signoffs).filter(
          (s) => s.status === "SIGNED",
        ).length;

        return {
          student_id: studentId,
          term_id: termId,
          departments: signoffs,
          completed: completedCount,
          total: DEPARTMENTS.length,
          fully_cleared: completedCount === DEPARTMENTS.length,
        };
      });

      return result;
    },
  );

  // ---------- POST /clearance/sign-off — sign or reject a department
  app.post(
    "/clearance/sign-off",
    {
      preHandler: requireRole(
        "admin",
        "registrar",
        "hod",
        "dean",
        "finance",
        "instructor",
      ),
    },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = SignOffSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { student_id, term_id, department, status, remarks } = parsed.data;
      const actorUserId = req.user?.userId ?? null;

      const row = await withTenant(tid, async (client) => {
        // Verify student exists
        const { rows: stuRows } = await client.query(
          `SELECT id FROM app.students WHERE id = $1`,
          [student_id],
        );
        if (!stuRows[0]) return { notFound: true, message: "student not found" } as const;

        // Enforce eligibility prerequisites for specific departments (SIGNED only)
        if (status === "SIGNED") {
          const eligibility = await computeEligibility(client, student_id, term_id);

          if (!("notFound" in eligibility) && !("termNotFound" in eligibility)) {
            if (department === "accounts" && !eligibility.checks.fees_cleared.pass) {
              return {
                eligibilityFailed: true,
                message: `Finance clearance blocked: ${eligibility.checks.fees_cleared.detail}`,
              } as const;
            }
            if (department === "hod" && !eligibility.checks.marks_complete.pass) {
              return {
                eligibilityFailed: true,
                message: `HOD clearance blocked: ${eligibility.checks.marks_complete.detail}`,
              } as const;
            }
          }

          // Enforce sequential ordering: all prior steps must be SIGNED
          const currentStep = DEPT_STEP[department];
          if (currentStep !== undefined && currentStep > 1) {
            const { rows: priorRows } = await client.query<{
              department: string;
              status: string;
            }>(
              `SELECT department, status FROM app.clearance_signoffs
               WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
              [tid, student_id, term_id],
            );
            const priorSigned = new Set(
              priorRows.filter((r) => r.status === "SIGNED").map((r) => r.department),
            );
            // Find the first previous sequential step that is not yet SIGNED
            const blocker = CLEARANCE_STEPS.find(
              (s) => s.step < currentStep && !priorSigned.has(s.dept),
            );
            if (blocker) {
              return {
                sequentialBlocked: true,
                message: `Step ${blocker.step} (${blocker.label}) must be completed before signing off this step.`,
              } as const;
            }
          }
        }

        // Upsert sign-off
        const { rows } = await client.query(
          `INSERT INTO app.clearance_signoffs
             (tenant_id, student_id, term_id, department, status, signed_by, signed_at, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
           ON CONFLICT (tenant_id, student_id, term_id, department)
           DO UPDATE SET status = EXCLUDED.status,
                         signed_by = EXCLUDED.signed_by,
                         signed_at = now(),
                         remarks = EXCLUDED.remarks
           RETURNING *`,
          [tid, student_id, term_id, department, status, actorUserId, remarks ?? null],
        );

        return rows[0];
      });

      if (row && "notFound" in row)
        return reply.status(404).send({ error: row.message });
      if (row && "eligibilityFailed" in row)
        return reply.status(422).send({ error: row.message });
      if (row && "sequentialBlocked" in row)
        return reply.status(422).send({ error: row.message });

      return reply.status(201).send(row);
    },
  );

  // ---------- POST /clearance/init — initialise all 8 PENDING sign-offs for a student+term
  app.post<{ Body: { student_id: string; term_id: string } }>(
    "/clearance/init",
    { preHandler: requireRole("registrar", "admin") },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { student_id, term_id } = req.body ?? {};
      if (!student_id || !term_id)
        return reply
          .status(422)
          .send({ error: "student_id and term_id required" });

      const rows = await withTenant(tid, async (client) => {
        const inserted = [];
        for (const dept of DEPARTMENTS) {
          const { rows } = await client.query(
            `INSERT INTO app.clearance_signoffs
               (tenant_id, student_id, term_id, department, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             ON CONFLICT (tenant_id, student_id, term_id, department) DO NOTHING
             RETURNING *`,
            [tid, student_id, term_id, dept],
          );
          if (rows[0]) inserted.push(rows[0]);
        }
        return inserted;
      });

      return reply.status(201).send({ initialized: rows.length });
    },
  );
}
