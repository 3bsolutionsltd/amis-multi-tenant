import { apiFetch } from "../../lib/apiFetch";

// ─── IT Reports ───────────────────────────────────────────────────────────────

export interface ITReport {
  id: string;
  tenant_id: string;
  industrial_training_id: string;
  report_type: "student" | "supervisor";
  period: string;
  summary: string;
  challenges: string | null;
  recommendations: string | null;
  rating: number | null;
  submitted_by: string;
  submitted_at: string | null;
  created_at: string;
}

export interface CreateITReportBody {
  industrial_training_id: string;
  report_type: "student" | "supervisor";
  period: string;
  summary: string;
  challenges?: string;
  recommendations?: string;
  rating?: number;
  submitted_by: string;
}

export interface ITReportQuery {
  industrial_training_id?: string;
  report_type?: "student" | "supervisor";
  page?: number;
  limit?: number;
}

export async function listITReports(params?: ITReportQuery): Promise<ITReport[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return apiFetch(`/reports/it${qs ? `?${qs}` : ""}`);
}

export async function getITReport(id: string): Promise<ITReport> {
  return apiFetch(`/reports/it/${id}`);
}

export async function createITReport(body: CreateITReportBody): Promise<ITReport> {
  return apiFetch("/reports/it", { method: "POST", body: JSON.stringify(body) });
}

// ─── Teacher Evaluations ──────────────────────────────────────────────────────

export interface TeacherEvaluation {
  id: string;
  tenant_id: string;
  student_id: string;
  staff_id: string;
  academic_period: string;
  scores: Record<string, number>;
  comments: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface CreateEvaluationBody {
  student_id: string;
  staff_id: string;
  academic_period: string;
  scores: Record<string, number>;
  comments?: string;
}

export interface EvaluationQuery {
  staff_id?: string;
  student_id?: string;
  academic_period?: string;
  page?: number;
  limit?: number;
}

export async function listEvaluations(params?: EvaluationQuery): Promise<TeacherEvaluation[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return apiFetch(`/reports/evaluations${qs ? `?${qs}` : ""}`);
}

export async function getEvaluation(id: string): Promise<TeacherEvaluation> {
  return apiFetch(`/reports/evaluations/${id}`);
}

export async function createEvaluation(body: CreateEvaluationBody): Promise<TeacherEvaluation> {
  return apiFetch("/reports/evaluations", { method: "POST", body: JSON.stringify(body) });
}

// ─── Instructor Reports ───────────────────────────────────────────────────────

export interface InstructorReport {
  id: string;
  tenant_id: string;
  staff_id: string;
  report_type: "weekly" | "monthly";
  period: string;
  content: string;
  status: "draft" | "submitted";
  due_date: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInstructorReportBody {
  staff_id: string;
  report_type: "weekly" | "monthly";
  period: string;
  content: string;
  due_date?: string;
}

export interface UpdateInstructorReportBody {
  content?: string;
  status?: "draft" | "submitted";
  due_date?: string;
}

export interface InstructorReportQuery {
  staff_id?: string;
  report_type?: "weekly" | "monthly";
  status?: "draft" | "submitted";
  page?: number;
  limit?: number;
}

export async function listInstructorReports(
  params?: InstructorReportQuery
): Promise<InstructorReport[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return apiFetch(`/reports/instructor${qs ? `?${qs}` : ""}`);
}

export async function getInstructorReport(id: string): Promise<InstructorReport> {
  return apiFetch(`/reports/instructor/${id}`);
}

export async function createInstructorReport(
  body: CreateInstructorReportBody
): Promise<InstructorReport> {
  return apiFetch("/reports/instructor", { method: "POST", body: JSON.stringify(body) });
}

export async function updateInstructorReport(
  id: string,
  body: UpdateInstructorReportBody
): Promise<InstructorReport> {
  return apiFetch(`/reports/instructor/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
