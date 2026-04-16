import { apiFetch } from "../../lib/apiFetch";

export interface TermAnalytics {
  students: { total_active: number };
  term_registrations: {
    total: number;
    filters: { academic_year: string | null; term: string | null };
  };
  admissions_by_state: { state: string; count: number }[];
  marks_by_state: { state: string; count: number }[];
  students_by_programme: {
    code: string;
    title: string;
    student_count: number;
  }[];
  industrial_training_by_status: { status: string; count: number }[];
  field_placements_by_status: { status: string; count: number }[];
}

export function getTermAnalytics(params?: {
  academic_year?: string;
  term?: string;
}): Promise<TermAnalytics> {
  const qs = new URLSearchParams();
  if (params?.academic_year) qs.set("academic_year", params.academic_year);
  if (params?.term) qs.set("term", params.term);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<TermAnalytics>(`/analytics/term${query}`);
}
