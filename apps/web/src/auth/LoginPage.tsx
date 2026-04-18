import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ApiError } from "../lib/apiFetch";

const APP_NAME = "AMIS";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface TenantOption {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState(
    () => localStorage.getItem("amis_tenant_id") ?? "",
  );
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/tenants`)
      .then((r) => r.json())
      .then((data: TenantOption[]) => {
        setTenants(data);
        // Auto-select if stored tenantId matches, otherwise select first
        if (data.length > 0 && !data.some((t) => t.id === tenantId)) {
          setTenantId(data[0].id);
        }
      })
      .catch(() => {
        /* fallback: user can type UUID manually */
      })
      .finally(() => setTenantsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password, tenantId);
      const redirect = searchParams.get("redirect") ?? "/";
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email, password, or tenant ID.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          padding: "40px 36px",
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {APP_NAME}
        </h1>
        <p style={{ margin: "0 0 28px", color: "#6b7280", fontSize: 14 }}>
          Sign in to your account
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                outline: "none",
              }}
              autoComplete="email"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                outline: "none",
              }}
              autoComplete="current-password"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="tenantId" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              Institution
            </label>
            {tenants.length > 0 ? (
              <select
                id="tenantId"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  outline: "none",
                  background: "#fff",
                }}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="tenantId"
                type="text"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder={tenantsLoading ? "Loading..." : "Tenant ID"}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  outline: "none",
                }}
                autoComplete="off"
              />
            )}
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                color: "#b91c1c",
                fontSize: 13,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px 0",
              background: isSubmitting ? "#93c5fd" : "var(--primary-color, #2563EB)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
