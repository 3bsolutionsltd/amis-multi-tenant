import { apiFetch } from "../../lib/apiFetch";

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  admission_number: string | null;
  sponsorship_type: string | null;
  programme: string | null;
  email: string | null;
  phone: string | null;
  extension: Record<string, unknown>;
  // Guardian / Next-of-Kin (SR-F-002)
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;
  // Dropout tracking (SR-F-003)
  dropout_reason: string | null;
  dropout_date: string | null;
  dropout_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentBody {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  admission_number?: string;
  sponsorship_type?: string;
  programme?: string;
  email?: string;
  phone?: string;
  extension?: Record<string, unknown>;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relationship?: string;
}

export interface UpdateStudentBody {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  admission_number?: string;
  programme?: string;
  extension?: Record<string, unknown>;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relationship?: string;
}

export interface DeactivateStudentBody {
  dropout_reason?: string;
  dropout_date?: string;
  dropout_notes?: string;
}

export interface ListStudentsParams {
  search?: string;
  page?: number;
  limit?: number;
  include_inactive?: boolean;
}

export function listStudents(params?: ListStudentsParams): Promise<Student[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.include_inactive) q.set("include_inactive", "true");
  const qs = q.toString();
  return apiFetch<Student[]>(`/students${qs ? `?${qs}` : ""}`);
}

export function getStudent(id: string): Promise<Student> {
  return apiFetch<Student>(`/students/${id}`);
}

export function createStudent(body: CreateStudentBody): Promise<Student> {
  return apiFetch<Student>("/students", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateStudent(
  id: string,
  body: UpdateStudentBody,
): Promise<Student> {
  return apiFetch<Student>(`/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deactivateStudent(id: string, body?: DeactivateStudentBody): Promise<Student> {
  return apiFetch<Student>(`/students/${id}/deactivate`, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function reactivateStudent(id: string): Promise<Student> {
  return apiFetch<Student>(`/students/${id}/reactivate`, { method: "PATCH" });
}
