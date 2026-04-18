import { apiFetch } from "../../lib/apiFetch";

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
