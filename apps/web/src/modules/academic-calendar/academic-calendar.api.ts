import { apiFetch } from "../../lib/apiFetch";

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export function listAcademicYears(params?: { is_current?: boolean }): Promise<AcademicYear[]> {
  const q = new URLSearchParams();
  if (params?.is_current != null) q.set("is_current", String(params.is_current));
  const qs = q.toString();
  return apiFetch<AcademicYear[]>(`/academic-years${qs ? `?${qs}` : ""}`);
}

export function listTerms(params?: { academic_year_id?: string }): Promise<Term[]> {
  const q = new URLSearchParams();
  if (params?.academic_year_id) q.set("academic_year_id", params.academic_year_id);
  const qs = q.toString();
  return apiFetch<Term[]>(`/terms${qs ? `?${qs}` : ""}`);
}
