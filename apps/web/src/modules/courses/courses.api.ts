import { apiFetch } from "../../lib/apiFetch";
import { getAccessToken } from "../../lib/auth";

export interface Course {
  id: string;
  programme_id: string;
  code: string;
  title: string;
  credit_hours: number | null;
  course_type: "theory" | "practical" | "both" | null;
  year_of_study: number | null;
  semester: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListCoursesParams {
  programme_id?: string;
  search?: string;
  include_inactive?: boolean;
  page?: number;
  limit?: number;
}

export function listCourses(params?: ListCoursesParams): Promise<Course[]> {
  const q = new URLSearchParams();
  if (params?.programme_id) q.set("programme_id", params.programme_id);
  if (params?.search) q.set("search", params.search);
  if (params?.include_inactive) q.set("include_inactive", "true");
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<Course[]>(`/courses${qs ? `?${qs}` : ""}`);
}

export interface CreateCourseBody {
  programme_id: string;
  code: string;
  title: string;
  credit_hours?: number;
  course_type?: "theory" | "practical" | "both";
  year_of_study?: number;
  semester?: number;
}

export function createCourse(body: CreateCourseBody): Promise<Course> {
  return apiFetch<Course>("/courses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteCourse(id: string): Promise<void> {
  return apiFetch<void>(`/courses/${id}`, { method: "DELETE" });
}

export interface UpdateCourseBody {
  code?: string;
  title?: string;
  credit_hours?: number;
  course_type?: "theory" | "practical" | "both";
  year_of_study?: number;
  semester?: number;
}

export function updateCourse(id: string, body: UpdateCourseBody): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export interface CourseImportResult {
  imported: number;
  skipped: number;
  details: { row: number; reason: string }[];
}

export async function downloadCourseTemplate(): Promise<void> {
  const token = getAccessToken();
  const tid = localStorage.getItem("amis_tenant_id") ?? "";
  const devRole = localStorage.getItem("amis_dev_role") ?? "admin";
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "x-tenant-id": tid }
    : { "x-tenant-id": tid, "x-dev-role": devRole };

  const r = await fetch(`${base}/courses/import/template`, { headers: authHeaders });
  if (!r.ok) throw new Error("Failed to download template");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "courses_import_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importCourses(file: File): Promise<CourseImportResult> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<CourseImportResult>("/courses/import", {
    method: "POST",
    body: form,
  });
}
