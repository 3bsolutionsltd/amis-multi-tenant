import { apiFetch } from "../../lib/apiFetch";

export type PlacementStatus = "scheduled" | "active" | "completed" | "cancelled";
export type PlacementType = "field" | "clinical" | "community" | "industry";

export interface FieldPlacement {
  id: string;
  tenant_id: string;
  student_id: string;
  first_name?: string;
  last_name?: string;
  host_organisation: string;
  supervisor: string | null;
  placement_type: PlacementType;
  start_date: string | null;
  end_date: string | null;
  status: PlacementStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFieldPlacementBody {
  student_id: string;
  host_organisation: string;
  supervisor?: string;
  placement_type?: PlacementType;
  start_date?: string;
  end_date?: string;
  status?: PlacementStatus;
  notes?: string;
}

export interface UpdateFieldPlacementBody {
  host_organisation?: string;
  supervisor?: string | null;
  placement_type?: PlacementType;
  start_date?: string | null;
  end_date?: string | null;
  status?: PlacementStatus;
  notes?: string | null;
}

export interface ListFieldPlacementsParams {
  student_id?: string;
  placement_type?: PlacementType;
  status?: PlacementStatus;
  page?: number;
  limit?: number;
}

export function listFieldPlacements(
  params?: ListFieldPlacementsParams,
): Promise<FieldPlacement[]> {
  const q = new URLSearchParams();
  if (params?.student_id) q.set("student_id", params.student_id);
  if (params?.placement_type) q.set("placement_type", params.placement_type);
  if (params?.status) q.set("status", params.status);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<FieldPlacement[]>(`/field-placements${qs ? `?${qs}` : ""}`);
}

export function getFieldPlacement(id: string): Promise<FieldPlacement> {
  return apiFetch<FieldPlacement>(`/field-placements/${id}`);
}

export function createFieldPlacement(
  body: CreateFieldPlacementBody,
): Promise<FieldPlacement> {
  return apiFetch<FieldPlacement>("/field-placements", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateFieldPlacement(
  id: string,
  body: UpdateFieldPlacementBody,
): Promise<FieldPlacement> {
  return apiFetch<FieldPlacement>(`/field-placements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
