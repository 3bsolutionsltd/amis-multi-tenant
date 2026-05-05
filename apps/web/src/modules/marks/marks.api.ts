import { apiFetch } from "../../lib/apiFetch";

export interface Submission {
  id: string;
  tenant_id: string;
  course_id: string;
  programme: string;
  intake: string;
  term: string;
  created_by: string | null;
  created_at: string;
  correction_of_submission_id: string | null;
  current_state: string | null;
}

export interface EvidenceFile {
  url: string;
  name: string;
  type: string;
}

export interface MarkEntry {
  id: string;
  student_id: string;
  score: number;
  updated_by: string | null;
  updated_at: string;
  evidence_files: EvidenceFile[];
}

export interface SubmissionDetail extends Submission {
  entries: (MarkEntry & { first_name?: string; last_name?: string })[];
}

export interface CreateSubmissionBody {
  course_id: string;
  programme: string;
  intake: string;
  term: string;
  assessment_type?: string;
  weight?: number;
  correction_of_submission_id?: string;
}

export interface ListSubmissionsParams {
  course_id?: string;
  programme?: string;
  intake?: string;
  term?: string;
  current_state?: string;
  page?: number;
  limit?: number;
}

export function listSubmissions(
  params?: ListSubmissionsParams,
): Promise<Submission[]> {
  const q = new URLSearchParams();
  if (params?.course_id) q.set("course_id", params.course_id);
  if (params?.programme) q.set("programme", params.programme);
  if (params?.intake) q.set("intake", params.intake);
  if (params?.term) q.set("term", params.term);
  if (params?.current_state) q.set("current_state", params.current_state);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<Submission[]>(`/marks/submissions${qs ? `?${qs}` : ""}`);
}

export function getSubmission(id: string): Promise<SubmissionDetail> {
  return apiFetch<SubmissionDetail>(`/marks/submissions/${id}`);
}

export function createSubmission(
  body: CreateSubmissionBody,
): Promise<{ submission: Submission; workflowState: string }> {
  return apiFetch<{ submission: Submission; workflowState: string }>(
    "/marks/submissions",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function putEntries(
  submissionId: string,
  entries: { student_id: string; score: number }[],
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(
    `/marks/submissions/${submissionId}/entries`,
    { method: "PUT", body: JSON.stringify({ entries }) },
  );
}

export function getWorkflowDef(key: string): Promise<{
  key: string;
  initial_state: string;
  states: string[];
  transitions: { from: string; action: string; to: string }[];
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

export interface AuditEntry {
  id: string;
  entry_id: string;
  student_id: string | null;
  old_score: number | null;
  new_score: number;
  actor_user_id: string | null;
  changed_at: string;
}

export function getAuditLog(submissionId: string): Promise<AuditEntry[]> {
  return apiFetch<AuditEntry[]>(`/marks/submissions/${submissionId}/audit`);
}

// ---------- Evidence attachments (issue #93) ----------

export function uploadFile(file: File): Promise<EvidenceFile> {
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  const tenantId = localStorage.getItem("amis_tenant_id") ?? "";
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${base}/uploads`, {
    method: "POST",
    headers: { "x-tenant-id": tenantId },
    body: fd,
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
    return r.json() as Promise<EvidenceFile>;
  });
}

export function addEvidence(
  entryId: string,
  files: EvidenceFile[],
): Promise<{ id: string; evidence_files: EvidenceFile[] }> {
  return apiFetch(`/marks/entries/${entryId}/evidence`, {
    method: "PATCH",
    body: JSON.stringify({ files }),
  });
}

export function removeEvidence(
  entryId: string,
  url: string,
): Promise<{ id: string; evidence_files: EvidenceFile[] }> {
  return apiFetch(`/marks/entries/${entryId}/evidence`, {
    method: "DELETE",
    body: JSON.stringify({ url }),
  });
}
