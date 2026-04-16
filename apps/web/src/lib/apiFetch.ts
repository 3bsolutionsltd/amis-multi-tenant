import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  type AuthUser,
} from "./auth";

const BASE_URL = "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

async function doFetch(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<Response> {
  const accessToken = token !== undefined ? token : getAccessToken();
  const tenantId = localStorage.getItem("amis_tenant_id") ?? "";
  const devRole = localStorage.getItem("amis_dev_role") ?? "admin";

  const authHeaders: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "x-tenant-id": tenantId }
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

/**
 * Singleton refresh promise — if multiple 401s arrive simultaneously (e.g. the
 * dashboard fires 4 queries at once after the 15-min access token expires),
 * they all await the SAME refresh call instead of each trying to rotate the
 * refresh token independently. The second rotation would fail with 401 because
 * the token is already revoked, causing a spurious redirect to /login.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      window.location.href = "/login";
      throw new ApiError(401, null);
    }

    // Use raw fetch — /auth/refresh is public, no auth header needed
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      window.location.href = "/login";
      throw new ApiError(401, null);
    }

    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    };
    setTokens(data.accessToken, data.refreshToken, data.user);
    return data.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res = await doFetch(path, init);

  // On 401, attempt singleton token refresh then retry once
  if (res.status === 401) {
    try {
      const newAccessToken = await refreshAccessToken();
      res = await doFetch(path, init, newAccessToken);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      clearTokens();
      window.location.href = "/login";
      throw new ApiError(401, null);
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
