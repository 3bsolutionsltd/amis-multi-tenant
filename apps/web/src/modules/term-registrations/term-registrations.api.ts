import { apiFetch } from "../../lib/apiFetch";

export interface TermRegistration {
  id: string;
  tenant_id: string;
  student_id: string;
  academic_year: string;
  term: string;
  extension: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  admission_number: string | null;
  student_programme: string | null;
  current_state: string | null;
}

export interface ListTermRegistrationsParams {
  student_id?: string;
  academic_year?: string;
  term?: string;
  current_state?: string;
  page?: number;
  limit?: number;
}

export interface CreateTermRegistrationBody {
  student_id: string;
  academic_year: string;
  term: string;
  extension?: Record<string, unknown>;
}

export function listTermRegistrations(
  params?: ListTermRegistrationsParams,
): Promise<TermRegistration[]> {
  const q = new URLSearchParams();
  if (params?.student_id) q.set("student_id", params.student_id);
  if (params?.academic_year) q.set("academic_year", params.academic_year);
  if (params?.term) q.set("term", params.term);
  if (params?.current_state) q.set("current_state", params.current_state);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<TermRegistration[]>(
    `/term-registrations${qs ? `?${qs}` : ""}`,
  );
}

export function getTermRegistration(id: string): Promise<TermRegistration> {
  return apiFetch<TermRegistration>(`/term-registrations/${id}`);
}

export function createTermRegistration(
  body: CreateTermRegistrationBody,
): Promise<{ registration: TermRegistration; workflowState: string }> {
  return apiFetch<{ registration: TermRegistration; workflowState: string }>(
    "/term-registrations",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getWorkflowDef(key: string): Promise<{
  key: string;
  initial_state: string;
  states: string[];
  transitions: { from: string; action: string; to: string; required_role?: string }[];
}> {
  return apiFetch(`/workflows/${key}`);
}

export function fireTransition(
  entityType: string,
  entityId: string,
  workflowKey: string,
  action: string,
): Promise<{ instance: { current_state: string }; event: unknown }> {
  return apiFetch(`/workflow/${entityType}/${entityId}/transition`, {
    method: "POST",
    body: JSON.stringify({ workflowKey, action }),
  });
}
