import { apiFetch } from "../../lib/apiFetch";

export interface Application {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  programme: string;
  intake: string;
  dob: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  sponsorship_type: string | null;
  extension: Record<string, unknown>;
  created_at: string;
  current_state: string | null;
}

export interface CreateApplicationBody {
  first_name: string;
  last_name: string;
  programme: string;
  intake: string;
  dob?: string;
  gender?: string;
  email?: string;
  phone?: string;
  sponsorship_type?: string;
}

export interface ListApplicationsParams {
  search?: string;
  intake?: string;
  programme?: string;
  current_state?: string;
  page?: number;
  limit?: number;
}

export interface WorkflowDefinition {
  key: string;
  initial_state: string;
  states: string[];
  transitions: { from: string; action: string; to: string }[];
}

export interface WorkflowInstance {
  id: string;
  current_state: string;
  entity_type: string;
  entity_id: string;
}

export function listApplications(
  params?: ListApplicationsParams,
): Promise<Application[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.intake) q.set("intake", params.intake);
  if (params?.programme) q.set("programme", params.programme);
  if (params?.current_state) q.set("current_state", params.current_state);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<Application[]>(
    `/admissions/applications${qs ? `?${qs}` : ""}`,
  );
}

export function getApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/admissions/applications/${id}`);
}

export function createApplication(
  body: CreateApplicationBody,
): Promise<{ application: Application; workflowState: string }> {
  return apiFetch<{ application: Application; workflowState: string }>(
    "/admissions/applications",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getWorkflowDef(key: string): Promise<WorkflowDefinition> {
  return apiFetch<WorkflowDefinition>(`/workflows/${key}`);
}

export function getWorkflowState(
  entityType: string,
  entityId: string,
): Promise<WorkflowInstance> {
  return apiFetch<WorkflowInstance>(`/workflow/${entityType}/${entityId}`);
}

export function fireTransition(
  entityType: string,
  entityId: string,
  workflowKey: string,
  action: string,
): Promise<{ instance: WorkflowInstance; event: unknown }> {
  return apiFetch<{ instance: WorkflowInstance; event: unknown }>(
    `/workflow/${entityType}/${entityId}/transition`,
    {
      method: "POST",
      body: JSON.stringify({ workflowKey, action }),
    },
  );
}

export interface ImportPreviewResult {
  batchId: string;
  valid: Record<string, unknown>[];
  invalid: { row: unknown; errors: unknown }[];
  total: number;
}

export interface ImportConfirmResult {
  imported: number;
  skipped: number;
}

export function previewImport(
  filename: string,
  rows: Record<string, unknown>[],
): Promise<ImportPreviewResult> {
  return apiFetch<ImportPreviewResult>("/admissions/import", {
    method: "POST",
    body: JSON.stringify({ filename, rows }),
  });
}

export function confirmImport(batchId: string): Promise<ImportConfirmResult> {
  return apiFetch<ImportConfirmResult>(
    `/admissions/import/${batchId}/confirm`,
    { method: "POST" },
  );
}

export interface EnrollResult {
  student: { id: string; admission_number: string };
  application: Application;
}

export function enrollApplication(applicationId: string): Promise<EnrollResult> {
  return apiFetch<EnrollResult>(
    `/admissions/applications/${applicationId}/enroll`,
    { method: "POST" },
  );
}
