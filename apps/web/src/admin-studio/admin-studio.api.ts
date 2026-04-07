import { apiFetch } from "../lib/apiFetch";

export interface ConfigVersion {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface ConfigAuditEntry {
  id: string;
  config_id: string;
  action: string;
  performed_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConfigStatus {
  published: ConfigVersion | null;
  draft: ConfigVersion | null;
}

export function getConfigStatus(): Promise<ConfigStatus> {
  return apiFetch<ConfigStatus>("/config/status");
}

export function getConfigAudit(limit = 5): Promise<ConfigAuditEntry[]> {
  return apiFetch<ConfigAuditEntry[]>(`/config/audit?limit=${limit}`);
}

export function createDraft(
  payload: Record<string, unknown>,
): Promise<ConfigVersion> {
  return apiFetch<ConfigVersion>("/config/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function validateDraft(): Promise<{
  valid: boolean;
  config_id?: string;
}> {
  return apiFetch<{ valid: boolean; config_id?: string }>("/config/validate", {
    method: "POST",
  });
}

export function publishConfig(performedBy: string): Promise<unknown> {
  return apiFetch("/config/publish", {
    method: "POST",
    body: JSON.stringify({ performed_by: performedBy }),
  });
}

export function rollbackConfig(performedBy: string): Promise<unknown> {
  return apiFetch("/config/rollback", {
    method: "POST",
    body: JSON.stringify({ performed_by: performedBy }),
  });
}
