import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch } from "../lib/apiFetch";
import {
  getAuthUser,
  getRefreshToken,
  setTokens,
  clearTokens,
  type AuthUser,
} from "../lib/auth";

export type LoginResult = { status: "ok" } | { status: "otp_required"; otpSessionId: string };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string, tenantSlug?: string): Promise<LoginResult>;
  verifyOtp(otpSessionId: string, code: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ status: "ok" }),
  verifyOtp: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getAuthUser();
    setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string, tenantSlug?: string): Promise<{ status: "ok" } | { status: "otp_required"; otpSessionId: string }> => {
      const body: Record<string, string> = { email, password };
      if (tenantSlug) body.tenantSlug = tenantSlug;
      const res = await apiFetch<{
        accessToken?: string;
        refreshToken?: string;
        user?: AuthUser;
        status?: string;
        otpSessionId?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.status === "otp_required" && res.otpSessionId) {
        return { status: "otp_required", otpSessionId: res.otpSessionId };
      }
      setTokens(res.accessToken!, res.refreshToken!, res.user!);
      setUser(res.user!);
      return { status: "ok" };
    },
    [],
  );

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    // Fire-and-forget — revoke on server best-effort, don't block the redirect
    if (refreshToken) {
      apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const verifyOtp = useCallback(
    async (otpSessionId: string, code: string) => {
      const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        "/auth/verify-otp",
        { method: "POST", body: JSON.stringify({ otpSessionId, code }) },
      );
      setTokens(res.accessToken, res.refreshToken, res.user);
      setUser(res.user);
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
