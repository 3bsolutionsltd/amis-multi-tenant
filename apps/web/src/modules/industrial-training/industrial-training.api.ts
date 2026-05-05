import { apiFetch } from "../../lib/apiFetch";

export type TrainingStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface IndustrialTraining {
  id: string;
  tenant_id: string;
  student_id: string;
  first_name?: string;
  last_name?: string;
  company: string;
  supervisor: string | null;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TrainingStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIndustrialTrainingBody {
  student_id: string;
  company: string;
  supervisor?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  status?: TrainingStatus;
  notes?: string;
}

export interface UpdateIndustrialTrainingBody {
  company?: string;
  supervisor?: string | null;
  department?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: TrainingStatus;
  notes?: string | null;
}

export interface ListIndustrialTrainingParams {
  student_id?: string;
  status?: TrainingStatus;
  page?: number;
  limit?: number;
}

export function listIndustrialTraining(
  params?: ListIndustrialTrainingParams,
): Promise<IndustrialTraining[]> {
  const q = new URLSearchParams();
  if (params?.student_id) q.set("student_id", params.student_id);
  if (params?.status) q.set("status", params.status);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<IndustrialTraining[]>(
    `/industrial-training${qs ? `?${qs}` : ""}`,
  );
}

export function getIndustrialTraining(id: string): Promise<IndustrialTraining> {
  return apiFetch<IndustrialTraining>(`/industrial-training/${id}`);
}

export function createIndustrialTraining(
  body: CreateIndustrialTrainingBody,
): Promise<IndustrialTraining> {
  return apiFetch<IndustrialTraining>("/industrial-training", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateIndustrialTraining(
  id: string,
  body: UpdateIndustrialTrainingBody,
): Promise<IndustrialTraining> {
  return apiFetch<IndustrialTraining>(`/industrial-training/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ---------- IT Logbook ----------

export interface LogEntry {
  id: string;
  it_assignment_id: string;
  student_id: string;
  log_date: string;
  task_description: string;
  learning_points: string | null;
  supervisor_verified: boolean;
  verified_at: string | null;
  verified_by_name: string | null;
  verification_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLogEntryBody {
  log_date: string;
  task_description: string;
  learning_points?: string;
}

export interface UpdateLogEntryBody {
  task_description?: string;
  learning_points?: string | null;
}

export function listLogEntries(
  assignmentId: string,
  page = 1,
): Promise<LogEntry[]> {
  return apiFetch<LogEntry[]>(
    `/industrial-training/${assignmentId}/logs?page=${page}&limit=50`,
  );
}

export function createLogEntry(
  assignmentId: string,
  body: CreateLogEntryBody,
): Promise<LogEntry> {
  return apiFetch<LogEntry>(`/industrial-training/${assignmentId}/logs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateLogEntry(
  logId: string,
  body: UpdateLogEntryBody,
): Promise<LogEntry> {
  return apiFetch<LogEntry>(`/industrial-training/logs/${logId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function verifyLogEntry(
  logId: string,
  pin: string,
): Promise<LogEntry> {
  return apiFetch<LogEntry>(`/industrial-training/logs/${logId}/verify`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function setSupervisorPin(
  assignmentId: string,
  pin: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    `/industrial-training/${assignmentId}/supervisor-pin`,
    { method: "POST", body: JSON.stringify({ pin }) },
  );
}
