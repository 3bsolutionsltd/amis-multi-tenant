import { apiFetch, downloadBlob } from "../../lib/apiFetch";

export type MarksheetTemplate = "master" | "uvtab" | "instructor" | "registrar" | "principal";

export interface MarksheetAssessment {
  submission_id: string;
  assessment_type: string;
  weight: number | null;
  assessment_date: string | null;
  current_state: string | null;
}

export interface MarksheetStudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  scores: Record<string, number | null>;
  total: number | null;
  grade: string | null;
}

export interface Marksheet {
  course: { code: string; title: string | null };
  programme: string | null;
  intake: string;
  term: string;
  assessments: MarksheetAssessment[];
  students: MarksheetStudentRow[];
}

export interface MarksheetParams {
  course_id: string;
  programme?: string;
  intake: string;
  term: string;
}

export function getMarksheet(params: MarksheetParams): Promise<Marksheet> {
  const q = new URLSearchParams();
  q.set("course_id", params.course_id);
  if (params.programme) q.set("programme", params.programme);
  q.set("intake", params.intake);
  q.set("term", params.term);
  return apiFetch<Marksheet>(`/marksheet?${q.toString()}`);
}

export function exportMarksheet(
  params: MarksheetParams & { template: MarksheetTemplate },
): Promise<void> {
  const q = new URLSearchParams();
  q.set("course_id", params.course_id);
  if (params.programme) q.set("programme", params.programme);
  q.set("intake", params.intake);
  q.set("term", params.term);
  q.set("template", params.template);
  return downloadBlob(
    `/marksheet/export?${q.toString()}`,
    `marksheet_${params.template}_${params.course_id}_${params.term}.csv`.replace(/\s+/g, "_"),
  );
}
