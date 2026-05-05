import { apiFetch } from "../../lib/apiFetch";

export type ProjectStatus = "draft" | "active" | "submitted" | "assessed";

export interface StudentProject {
  id: string;
  tenant_id: string;
  student_id: string;
  term_id: string | null;
  course_id: string | null;
  project_title: string;
  description: string | null;
  status: ProjectStatus;
  mark_entry_id: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
}

export interface StudentProjectDetail extends StudentProject {
  issuances: {
    id: string;
    issued_at: string;
    notes: string | null;
    items: { item_name: string; quantity: number; unit: string }[];
  }[];
}

export interface CostingLine {
  item_name: string;
  unit: string;
  total_qty: number;
  unit_cost: string;
  line_total: string;
}

export interface ProjectCosting {
  project_id: string;
  project_title: string;
  line_items: CostingLine[];
  grand_total: number;
}

export interface CreateStudentProjectBody {
  student_id: string;
  term_id?: string;
  course_id?: string;
  project_title: string;
  description?: string;
  status?: ProjectStatus;
  mark_entry_id?: string;
}

export interface UpdateStudentProjectBody {
  project_title?: string;
  description?: string | null;
  status?: ProjectStatus;
  term_id?: string | null;
  course_id?: string | null;
  mark_entry_id?: string | null;
}

export interface ListStudentProjectsParams {
  student_id?: string;
  term_id?: string;
  status?: ProjectStatus;
  page?: number;
  limit?: number;
}

export function listStudentProjects(
  params?: ListStudentProjectsParams,
): Promise<StudentProject[]> {
  const q = new URLSearchParams();
  if (params?.student_id) q.set("student_id", params.student_id);
  if (params?.term_id) q.set("term_id", params.term_id);
  if (params?.status) q.set("status", params.status);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<StudentProject[]>(
    `/student-projects${qs ? `?${qs}` : ""}`,
  );
}

export function createStudentProject(
  body: CreateStudentProjectBody,
): Promise<StudentProject> {
  return apiFetch<StudentProject>("/student-projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getStudentProject(id: string): Promise<StudentProjectDetail> {
  return apiFetch<StudentProjectDetail>(`/student-projects/${id}`);
}

export function updateStudentProject(
  id: string,
  body: UpdateStudentProjectBody,
): Promise<StudentProject> {
  return apiFetch<StudentProject>(`/student-projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getProjectCosting(id: string): Promise<ProjectCosting> {
  return apiFetch<ProjectCosting>(`/student-projects/${id}/costing`);
}
