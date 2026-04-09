import { getAccessToken, getRefreshToken, setTokens, clearTokens, type AuthUser } from "./auth";

const BASE_URL = "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

async function doFetch(path: string, init?: RequestInit, accessToken?: string | null): Promise<Response> {
  const token = accessToken ?? getAccessToken();
  const tenantId = localStorage.getItem("amis_tenant_id") ?? "";
  const devRole = localStorage.getItem("amis_dev_role") ?? "admin";

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : { "x-tenant-id": tenantId, "x-dev-role": devRole };

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res = await doFetch(path, init);

  // On 401, attempt token refresh then retry once
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json() as {
            accessToken: string;
            refreshToken: string;
            user: AuthUser;
          };
          setTokens(refreshData.accessToken, refreshData.refreshToken, refreshData.user);
          res = await doFetch(path, init, refreshData.accessToken);
        } else {
          clearTokens();
          window.location.href = "/login";
          throw new ApiError(401, null);
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        clearTokens();
        window.location.href = "/login";
        throw new ApiError(401, null);
      }
    } else {
      clearTokens();
      window.location.href = "/login";
      throw new ApiError(401, null);
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
