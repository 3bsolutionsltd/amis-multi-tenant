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

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string, tenantSlug: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
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
    async (email: string, password: string, tenantSlug: string) => {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      setTokens(res.accessToken, res.refreshToken, res.user);
      setUser(res.user);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
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
