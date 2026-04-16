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
