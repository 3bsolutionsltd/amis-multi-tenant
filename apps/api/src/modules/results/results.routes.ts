import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";

// ------------------------------------------------------------------ constants

const PROCESS_ROLES = ["admin", "registrar", "dean", "principal"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

// ------------------------------------------------------------------ routes

export async function resultsRoutes(app: FastifyInstance) {
  // ---------- POST /results/terms/:termId/process
  // Aggregate published marks → term_results + term_gpa with GPA & ranking
  app.post<{ Params: { termId: string } }>(
    "/results/terms/:termId/process",
    { preHandler: requireRole(...PROCESS_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { termId } = req.params;

      const result = await withTenant(tid, async (client) => {
        // Verify term exists
        const { rows: termRows } = await client.query(
          `SELECT id, name FROM app.terms WHERE id = $1`,
          [termId],
        );
        if (termRows.length === 0) return { notFound: true } as const;

        // Gather all published mark entries for this term
        const { rows: marks } = await client.query(
          `SELECT me.student_id, ms.course_id, me.score
           FROM app.mark_entries me
           JOIN app.mark_submissions ms ON ms.id = me.submission_id
           JOIN app.workflow_instances wi
             ON wi.entity_type = 'marks' AND wi.entity_id = ms.id
           WHERE ms.term = $1 AND wi.current_state = 'PUBLISHED'
           ORDER BY me.student_id, ms.course_id`,
          [termId],
        );

        if (marks.length === 0) {
          return { processed: 0, message: "No published marks for this term" };
        }

        // Load grading scale boundaries (use first active scale)
        const { rows: boundaries } = await client.query(
          `SELECT gb.min_score, gb.max_score, gb.grade, gb.grade_point
           FROM app.grade_boundaries gb
           JOIN app.grading_scales gs ON gs.id = gb.scale_id
           WHERE gs.is_active = true
           ORDER BY gb.min_score DESC`,
        );

        function resolveGrade(score: number) {
          for (const b of boundaries) {
            if (score >= Number(b.min_score) && score <= Number(b.max_score)) {
              return { grade: b.grade, gradePoint: Number(b.grade_point) };
            }
          }
          return { grade: null, gradePoint: null };
        }

        // Clear previous results for this term
        await client.query(
          `DELETE FROM app.term_gpa WHERE term_id = $1`,
          [termId],
        );
        await client.query(
          `DELETE FROM app.term_results WHERE term_id = $1`,
          [termId],
        );

        // Insert term_results
        let insertedCount = 0;
        // Group by student for GPA
        const studentScores: Record<
          string,
          { totalPoints: number; count: number }
        > = {};

        for (const mark of marks) {
          const score = Number(mark.score);
          const { grade, gradePoint } = resolveGrade(score);

          await client.query(
            `INSERT INTO app.term_results
               (tenant_id, term_id, student_id, course_id, score, grade, grade_point)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (term_id, student_id, course_id)
             DO UPDATE SET score = $5, grade = $6, grade_point = $7`,
            [tid, termId, mark.student_id, mark.course_id, score, grade, gradePoint],
          );
          insertedCount++;

          if (!studentScores[mark.student_id]) {
            studentScores[mark.student_id] = { totalPoints: 0, count: 0 };
          }
          if (gradePoint !== null) {
            studentScores[mark.student_id].totalPoints += gradePoint;
            studentScores[mark.student_id].count += 1;
          }
        }

        // Calculate GPA and insert term_gpa
        const gpaEntries: { studentId: string; gpa: number }[] = [];
        for (const [studentId, { totalPoints, count }] of Object.entries(
          studentScores,
        )) {
          const gpa = count > 0 ? Math.round((totalPoints / count) * 100) / 100 : 0;
          gpaEntries.push({ studentId, gpa });

          await client.query(
            `INSERT INTO app.term_gpa
               (tenant_id, term_id, student_id, gpa, total_credits)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (term_id, student_id)
             DO UPDATE SET gpa = $4, total_credits = $5`,
            [tid, termId, studentId, gpa, count],
          );
        }

        // Assign ranks based on GPA descending
        gpaEntries.sort((a, b) => b.gpa - a.gpa);
        for (let i = 0; i < gpaEntries.length; i++) {
          const rank = i + 1;
          await client.query(
            `UPDATE app.term_gpa SET rank = $1
             WHERE term_id = $2 AND student_id = $3`,
            [rank, termId, gpaEntries[i].studentId],
          );
        }

        return {
          processed: insertedCount,
          students: gpaEntries.length,
          termId,
        };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "term not found" });

      return reply.status(200).send(result);
    },
  );

  // ---------- GET /results/terms/:termId
  // Retrieve processed results for a term
  app.get<{ Params: { termId: string } }>(
    "/results/terms/:termId",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { termId } = req.params;

      const result = await withTenant(tid, async (client) => {
        const { rows: gpaRows } = await client.query(
          `SELECT tg.student_id, tg.gpa, tg.total_credits, tg.rank,
                  s.first_name, s.last_name, s.admission_number
           FROM app.term_gpa tg
           JOIN app.students s ON s.id = tg.student_id
           WHERE tg.term_id = $1
           ORDER BY tg.rank ASC NULLS LAST`,
          [termId],
        );

        return gpaRows;
      });

      return result;
    },
  );

  // ---------- GET /results/students/:studentId/terms/:termId
  // Retrieve a specific student's results for a term
  app.get<{ Params: { studentId: string; termId: string } }>(
    "/results/students/:studentId/terms/:termId",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId, termId } = req.params;

      const result = await withTenant(tid, async (client) => {
        const { rows: results } = await client.query(
          `SELECT tr.course_id, tr.score, tr.grade, tr.grade_point
           FROM app.term_results tr
           WHERE tr.term_id = $1 AND tr.student_id = $2
           ORDER BY tr.course_id`,
          [termId, studentId],
        );

        const { rows: gpaRows } = await client.query(
          `SELECT gpa, total_credits, rank
           FROM app.term_gpa
           WHERE term_id = $1 AND student_id = $2`,
          [termId, studentId],
        );

        return {
          studentId,
          termId,
          courses: results,
          summary: gpaRows[0] ?? null,
        };
      });

      return result;
    },
  );

  // ---------- GET /results/students/:studentId/transcript
  // Full academic transcript — all terms a student has results in
  app.get<{ Params: { studentId: string } }>(
    "/results/students/:studentId/transcript",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { studentId } = req.params;

      const result = await withTenant(tid, async (client) => {
        // Student info
        const { rows: studentRows } = await client.query(
          `SELECT id, first_name, last_name, admission_number, programme,
                  year_of_study, class_section
           FROM app.students WHERE id = $1`,
          [studentId],
        );
        if (studentRows.length === 0) return { notFound: true } as const;
        const student = studentRows[0];

        // All terms with results for this student, ordered chronologically
        const { rows: termRows } = await client.query(
          `SELECT DISTINCT t.id, t.name, t.academic_year, t.term_number
           FROM app.terms t
           JOIN app.term_results tr ON tr.term_id = t.id
           WHERE tr.student_id = $1
           ORDER BY t.academic_year, t.term_number`,
          [studentId],
        );

        // Per-term courses and GPA
        const terms = [];
        for (const term of termRows) {
          const { rows: courses } = await client.query(
            `SELECT tr.course_id, tr.score, tr.grade, tr.grade_point
             FROM app.term_results tr
             WHERE tr.term_id = $1 AND tr.student_id = $2
             ORDER BY tr.course_id`,
            [term.id, studentId],
          );

          const { rows: gpa } = await client.query(
            `SELECT gpa, total_credits, rank
             FROM app.term_gpa
             WHERE term_id = $1 AND student_id = $2`,
            [term.id, studentId],
          );

          terms.push({
            termId: term.id,
            termName: term.name,
            academicYear: term.academic_year,
            termNumber: term.term_number,
            courses,
            summary: gpa[0] ?? null,
          });
        }

        // Cumulative GPA across all terms
        const allGpa = terms
          .map((t) => t.summary?.gpa)
          .filter((g): g is number => g != null);
        const cumulativeGpa =
          allGpa.length > 0
            ? Math.round(
                (allGpa.reduce((a, b) => a + Number(b), 0) / allGpa.length) *
                  100,
              ) / 100
            : null;

        return { student, terms, cumulativeGpa };
      });

      if ("notFound" in result)
        return reply.status(404).send({ error: "student not found" });

      return result;
    },
  );

  // ---------- GET /results/analysis
  // Marks analysis: grade distribution, pass/fail rates, mean score per course/programme
  app.get(
    "/results/analysis",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const q = req.query as {
        term_id?: string;
        programme?: string;
        course_id?: string;
      };

      const result = await withTenant(tid, async (client) => {
        // ── 1. Per-course summary ──────────────────────────────────────
        const courseConditions: string[] = [];
        const courseParams: unknown[] = [];

        if (q.term_id) {
          courseParams.push(q.term_id);
          courseConditions.push(`tr.term_id = $${courseParams.length}`);
        }
        if (q.programme) {
          courseParams.push(q.programme);
          courseConditions.push(`s.programme = $${courseParams.length}`);
        }
        if (q.course_id) {
          courseParams.push(q.course_id);
          courseConditions.push(`tr.course_id = $${courseParams.length}`);
        }

        const courseWhere =
          courseConditions.length > 0
            ? `AND ${courseConditions.join(" AND ")}`
            : "";

        const { rows: byCourse } = await client.query(
          `SELECT
             tr.course_id,
             COUNT(*)                                         AS total_students,
             ROUND(AVG(tr.score)::numeric, 2)                AS mean_score,
             ROUND(MIN(tr.score)::numeric, 2)                AS min_score,
             ROUND(MAX(tr.score)::numeric, 2)                AS max_score,
             COUNT(*) FILTER (WHERE tr.score >= 50)          AS passed,
             COUNT(*) FILTER (WHERE tr.score < 50)           AS failed,
             COUNT(*) FILTER (WHERE tr.grade = 'A')          AS grade_a,
             COUNT(*) FILTER (WHERE tr.grade = 'B')          AS grade_b,
             COUNT(*) FILTER (WHERE tr.grade = 'C')          AS grade_c,
             COUNT(*) FILTER (WHERE tr.grade = 'D')          AS grade_d,
             COUNT(*) FILTER (WHERE tr.grade = 'F' OR tr.score < 50) AS grade_f
           FROM app.term_results tr
           JOIN app.students s ON s.id = tr.student_id
           WHERE tr.tenant_id = ${"$" + (courseParams.length + 1)}
           ${courseWhere}
           GROUP BY tr.course_id
           ORDER BY tr.course_id`,
          [...courseParams, tid],
        );

        // ── 2. Programme-level summary ─────────────────────────────────
        const progConditions: string[] = [];
        const progParams: unknown[] = [];

        if (q.term_id) {
          progParams.push(q.term_id);
          progConditions.push(`tr.term_id = $${progParams.length}`);
        }
        if (q.programme) {
          progParams.push(q.programme);
          progConditions.push(`s.programme = $${progParams.length}`);
        }

        const progWhere =
          progConditions.length > 0
            ? `AND ${progConditions.join(" AND ")}`
            : "";

        const { rows: byProgramme } = await client.query(
          `SELECT
             s.programme,
             COUNT(DISTINCT tr.student_id)                   AS total_students,
             ROUND(AVG(tr.score)::numeric, 2)                AS mean_score,
             COUNT(*) FILTER (WHERE tr.score >= 50)          AS passed,
             COUNT(*) FILTER (WHERE tr.score < 50)           AS failed,
             ROUND(AVG(tg.gpa)::numeric, 2)                  AS mean_gpa
           FROM app.term_results tr
           JOIN app.students s ON s.id = tr.student_id
           LEFT JOIN app.term_gpa tg
             ON tg.student_id = tr.student_id
             AND tg.term_id = tr.term_id
           WHERE tr.tenant_id = ${"$" + (progParams.length + 1)}
           ${progWhere}
           GROUP BY s.programme
           ORDER BY s.programme`,
          [...progParams, tid],
        );

        // ── 3. GPA distribution buckets (overall) ─────────────────────
        const gpaConditions: string[] = [];
        const gpaParams: unknown[] = [];

        if (q.term_id) {
          gpaParams.push(q.term_id);
          gpaConditions.push(`tg.term_id = $${gpaParams.length}`);
        }

        const gpaWhere =
          gpaConditions.length > 0
            ? `AND ${gpaConditions.join(" AND ")}`
            : "";

        const { rows: gpaDistrib } = await client.query(
          `SELECT
             CASE
               WHEN tg.gpa >= 4.5 THEN 'First Class (4.5+)'
               WHEN tg.gpa >= 3.5 THEN 'Upper Second (3.5–4.4)'
               WHEN tg.gpa >= 2.5 THEN 'Lower Second (2.5–3.4)'
               WHEN tg.gpa >= 1.5 THEN 'Pass (1.5–2.4)'
               ELSE 'Fail (<1.5)'
             END AS classification,
             COUNT(*)                              AS count,
             ROUND(AVG(tg.gpa)::numeric, 2)        AS avg_gpa
           FROM app.term_gpa tg
           JOIN app.students s ON s.id = tg.student_id
           WHERE tg.tenant_id = ${"$" + (gpaParams.length + 1)}
           ${gpaWhere}
           GROUP BY 1
           ORDER BY MIN(tg.gpa) DESC`,
          [...gpaParams, tid],
        );

        return {
          by_course: byCourse.map((r: Record<string, unknown>) => ({
            course_id: r.course_id,
            total_students: Number(r.total_students),
            mean_score: Number(r.mean_score),
            min_score: Number(r.min_score),
            max_score: Number(r.max_score),
            passed: Number(r.passed),
            failed: Number(r.failed),
            pass_rate:
              Number(r.total_students) > 0
                ? Math.round((Number(r.passed) / Number(r.total_students)) * 100)
                : 0,
            grade_distribution: {
              A: Number(r.grade_a),
              B: Number(r.grade_b),
              C: Number(r.grade_c),
              D: Number(r.grade_d),
              F: Number(r.grade_f),
            },
          })),
          by_programme: byProgramme.map((r: Record<string, unknown>) => ({
            programme: r.programme,
            total_students: Number(r.total_students),
            mean_score: Number(r.mean_score),
            passed: Number(r.passed),
            failed: Number(r.failed),
            pass_rate:
              Number(r.total_students) > 0
                ? Math.round((Number(r.passed) / Number(r.total_students)) * 100)
                : 0,
            mean_gpa: r.mean_gpa != null ? Number(r.mean_gpa) : null,
          })),
          gpa_distribution: gpaDistrib.map((r: Record<string, unknown>) => ({
            classification: r.classification,
            count: Number(r.count),
            avg_gpa: Number(r.avg_gpa),
          })),
          filters: {
            term_id: q.term_id ?? null,
            programme: q.programme ?? null,
            course_id: q.course_id ?? null,
          },
        };
      });

      return reply.status(200).send(result);
    },
  );
}
