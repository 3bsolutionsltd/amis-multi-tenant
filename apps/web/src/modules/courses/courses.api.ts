import { apiFetch } from "../../lib/apiFetch";

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
