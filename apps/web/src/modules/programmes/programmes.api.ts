import { apiFetch } from "../../lib/apiFetch";

export interface Programme {
  id: string;
  code: string;
  title: string;
  department: string | null;
  duration_months: number | null;
  level: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProgrammeBody {
  code: string;
  title: string;
  department?: string;
  duration_months?: number;
  level?: string;
}

export interface UpdateProgrammeBody {
  code?: string;
  title?: string;
  department?: string;
  duration_months?: number;
  level?: string;
  is_active?: boolean;
}

export interface ListProgrammesParams {
  search?: string;
  include_inactive?: boolean;
  page?: number;
  limit?: number;
}

export function listProgrammes(params?: ListProgrammesParams): Promise<Programme[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.include_inactive) q.set("include_inactive", "true");
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<Programme[]>(`/programmes${qs ? `?${qs}` : ""}`);
}

export function getProgramme(id: string): Promise<Programme> {
  return apiFetch<Programme>(`/programmes/${id}`);
}

export function createProgramme(body: CreateProgrammeBody): Promise<Programme> {
  return apiFetch<Programme>("/programmes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateProgramme(id: string, body: UpdateProgrammeBody): Promise<Programme> {
  return apiFetch<Programme>(`/programmes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteProgramme(id: string): Promise<void> {
  return apiFetch<void>(`/programmes/${id}`, { method: "DELETE" });
}
