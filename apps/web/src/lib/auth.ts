// Thin wrapper around localStorage for token persistence.
// Keys: amis_access_token, amis_refresh_token, amis_user (JSON)

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem("amis_access_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("amis_refresh_token");
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem("amis_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
): void {
  localStorage.setItem("amis_access_token", accessToken);
  localStorage.setItem("amis_refresh_token", refreshToken);
  localStorage.setItem("amis_user", JSON.stringify(user));
  localStorage.setItem("amis_tenant_id", user.tenantId);
}

export function clearTokens(): void {
  localStorage.removeItem("amis_access_token");
  localStorage.removeItem("amis_refresh_token");
  localStorage.removeItem("amis_user");
}
