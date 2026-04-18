import { apiFetch } from "../../lib/apiFetch";

export interface Alumni {
  id: string;
  tenant_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  programme: string | null;
  admission_number: string | null;
  graduation_date: string;
  graduation_notes: string | null;
  graduated_by: string | null;
  created_at: string;
}

export interface GraduateStudentBody {
  graduation_date: string;
  graduation_notes?: string;
}

export interface ListAlumniParams {
  search?: string;
  page?: number;
  limit?: number;
}

export function listAlumni(params?: ListAlumniParams): Promise<Alumni[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<Alumni[]>(`/alumni${qs ? `?${qs}` : ""}`);
}

export function getAlumniRecord(id: string): Promise<Alumni> {
  return apiFetch<Alumni>(`/alumni/${id}`);
}

export function graduateStudent(
  studentId: string,
  body: GraduateStudentBody,
): Promise<{ alumni: Alumni }> {
  return apiFetch<{ alumni: Alumni }>(`/students/${studentId}/graduate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function exportAlumniCsv(): string {
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  return `${base}/alumni/export/csv`;
}
