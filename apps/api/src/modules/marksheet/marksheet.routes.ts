import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import type { PoolClient } from "pg";
import {
  MarksheetQuerySchema,
  MarksheetExportQuerySchema,
  type MarksheetTemplate,
} from "./marksheet.schema.js";

const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "principal",
  "dean",
] as const;

interface AssessmentCol {
  submission_id: string;
  assessment_type: string;
  weight: number | null;
  assessment_date: string | null;
  current_state: string | null;
}

interface MarksheetRow {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  scores: Record<string, number | null>;
  total: number | null;
  grade: string | null;
}

async function buildMarksheet(
  client: PoolClient,
  tid: string,
  params: { course_id: string; programme?: string; intake: string; term: string },
) {
  const { course_id, programme, intake, term } = params;

  const { rows: courseRows } = await client.query<{ title: string }>(
    `SELECT title FROM app.courses WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
    [tid, course_id],
  );
  const courseTitle = courseRows[0]?.title ?? null;

  const subConds = ["s.tenant_id = $1", "s.course_id = $2", "s.intake = $3", "s.term = $4"];
  const subParams: unknown[] = [tid, course_id, intake, term];
  if (programme) {
    subParams.push(programme);
    subConds.push(`s.programme = $${subParams.length}`);
  }

  const { rows: assessments } = await client.query<AssessmentCol>(
    `SELECT s.id AS submission_id, s.assessment_type, s.weight, s.assessment_date,
            wi.current_state
     FROM app.mark_submissions s
     LEFT JOIN app.workflow_instances wi
       ON wi.entity_type = 'marks' AND wi.entity_id = s.id
     WHERE ${subConds.join(" AND ")}
     ORDER BY s.assessment_date NULLS LAST, s.created_at`,
    subParams,
  );

  const submissionIds = assessments.map((a) => a.submission_id);

  const entriesBySubStudent = new Map<string, Map<string, number>>();
  if (submissionIds.length > 0) {
    const { rows: entries } = await client.query<{
      submission_id: string;
      student_id: string;
      score: string;
    }>(
      `SELECT submission_id, student_id, score FROM app.mark_entries
       WHERE submission_id = ANY($1::uuid[])`,
      [submissionIds],
    );
    for (const e of entries) {
      if (!entriesBySubStudent.has(e.submission_id)) {
        entriesBySubStudent.set(e.submission_id, new Map());
      }
      entriesBySubStudent.get(e.submission_id)!.set(e.student_id, Number(e.score));
    }
  }

  // Roster: prefer the enrolled programme roster; fall back to students who
  // already have entries (e.g. programme couldn't be resolved).
  let roster: { id: string; first_name: string; last_name: string; admission_number: string | null }[] = [];
  if (programme) {
    const { rows } = await client.query(
      `SELECT id, first_name, last_name, admission_number
       FROM app.students
       WHERE tenant_id = $1 AND is_active = true
         AND (programme_code = $2 OR programme = $2)
       ORDER BY last_name, first_name`,
      [tid, programme],
    );
    roster = rows;
  }
  if (roster.length === 0 && submissionIds.length > 0) {
    const studentIds = new Set<string>();
    for (const m of entriesBySubStudent.values()) {
      for (const sid of m.keys()) studentIds.add(sid);
    }
    if (studentIds.size > 0) {
      const { rows } = await client.query(
        `SELECT id, first_name, last_name, admission_number
         FROM app.students WHERE id = ANY($1::uuid[])
         ORDER BY last_name, first_name`,
        [Array.from(studentIds)],
      );
      roster = rows;
    }
  }

  const { rows: boundaries } = await client.query<{
    min_score: string;
    max_score: string;
    grade_letter: string;
  }>(
    `SELECT gb.min_score, gb.max_score, gb.grade_letter
     FROM app.grade_boundaries gb
     JOIN app.grading_scales gs ON gs.id = gb.grading_scale_id
     WHERE gs.tenant_id = $1 AND gs.is_default = true
     ORDER BY gb.min_score DESC`,
    [tid],
  );

  function resolveGrade(score: number): string | null {
    for (const b of boundaries) {
      if (score >= Number(b.min_score) && score <= Number(b.max_score)) return b.grade_letter;
    }
    return null;
  }

  const studentRows: MarksheetRow[] = roster.map((s) => {
    const scores: Record<string, number | null> = {};
    let total = 0;
    let hasWeighted = false;
    for (const a of assessments) {
      const score = entriesBySubStudent.get(a.submission_id)?.get(s.id) ?? null;
      scores[a.submission_id] = score;
      if (score != null && a.weight != null) {
        total += (score * Number(a.weight)) / 100;
        hasWeighted = true;
      }
    }
    const roundedTotal = hasWeighted ? Math.round(total * 100) / 100 : null;
    return {
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      admission_number: s.admission_number,
      scores,
      total: roundedTotal,
      grade: roundedTotal != null ? resolveGrade(roundedTotal) : null,
    };
  });

  return {
    course: { code: course_id, title: courseTitle },
    programme: programme ?? null,
    intake,
    term,
    assessments,
    students: studentRows,
  };
}

const TEMPLATE_LABELS: Record<MarksheetTemplate, string> = {
  master: "Master Marksheet",
  uvtab: "UVTAB Marksheet",
  instructor: "Instructor Marksheet",
  registrar: "Registrar Marksheet",
  principal: "Principal Marksheet",
};

// Principal's view is a summary only (no per-assessment breakdown).
function isSummaryOnly(template: MarksheetTemplate): boolean {
  return template === "principal";
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export async function marksheetRoutes(app: FastifyInstance) {
  // ---------- GET /marksheet
  app.get(
    "/marksheet",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = MarksheetQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const result = await withTenant(tid, (client) =>
        buildMarksheet(client, tid, parsed.data),
      );

      return reply.send(result);
    },
  );

  // ---------- GET /marksheet/export (CSV)
  app.get(
    "/marksheet/export",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = MarksheetExportQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { template, ...query } = parsed.data;

      const sheet = await withTenant(tid, (client) => buildMarksheet(client, tid, query));

      const summaryOnly = isSummaryOnly(template);
      const headers = ["S/N", "Registration No.", "Surname"];
      if (!summaryOnly) {
        for (const a of sheet.assessments) headers.push(`${a.assessment_type} (${a.weight ?? "-"}%)`);
      }
      headers.push("Total", "Grade");
      if (template !== "registrar" && template !== "principal") headers.push("Signature");

      const lines = [headers.map(csvEscape).join(",")];
      sheet.students.forEach((s, i) => {
        const row: unknown[] = [i + 1, s.admission_number ?? "", `${s.last_name}, ${s.first_name}`];
        if (!summaryOnly) {
          for (const a of sheet.assessments) row.push(s.scores[a.submission_id] ?? "");
        }
        row.push(s.total ?? "", s.grade ?? "");
        if (template !== "registrar" && template !== "principal") row.push("");
        lines.push(row.map(csvEscape).join(","));
      });

      const csv = lines.join("\n");
      const filename = `${TEMPLATE_LABELS[template].replace(/\s+/g, "_")}_${sheet.course.code}_${sheet.term}.csv`
        .replace(/[^\w.-]/g, "_");

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    },
  );
}
