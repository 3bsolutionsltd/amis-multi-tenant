import { apiFetch } from "../../lib/apiFetch";

export interface TenantInfo {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface PublicApplication {
  id: string;
  first_name: string;
  last_name: string;
  programme: string;
  intake: string;
  created_at: string;
  current_state?: string;
}

export interface PublicApplyBody {
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

export interface PublicProgramme {
  id: string;
  code: string;
  title: string;
  department: string | null;
  duration_months: number | null;
  level: string | null;
}

export function getTenantInfo(tenantSlug: string): Promise<TenantInfo> {
  return apiFetch<TenantInfo>(`/public/${tenantSlug}/info`);
}

export function listPublicProgrammes(
  tenantSlug: string,
): Promise<PublicProgramme[]> {
  return apiFetch<PublicProgramme[]>(`/public/${tenantSlug}/programmes`);
}

export function submitPublicApplication(
  tenantSlug: string,
  body: PublicApplyBody,
): Promise<{ application: PublicApplication }> {
  return apiFetch<{ application: PublicApplication }>(
    `/public/${tenantSlug}/apply`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function checkApplicationStatus(
  tenantSlug: string,
  applicationId: string,
): Promise<{ application: PublicApplication }> {
  return apiFetch<{ application: PublicApplication }>(
    `/public/${tenantSlug}/applications/${applicationId}/status`,
  );
}
