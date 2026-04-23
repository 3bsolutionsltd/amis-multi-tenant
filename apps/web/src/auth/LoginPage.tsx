import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ApiError } from "../lib/apiFetch";
import { getAuthUser } from "../lib/auth";

const APP_NAME = "AMIS";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const SLUG_STORAGE_KEY = "amis_tenant_slug";

interface TenantInfo {
  name: string;
  logoUrl: string | null;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // The tenant slug comes from ?org= query param
  const orgSlug = searchParams.get("org")?.trim() ?? "";

  // --- State for the "find your institution" mode (no ?org= in URL) ---
  const [slugInput, setSlugInput] = useState(
    () => !orgSlug ? (localStorage.getItem(SLUG_STORAGE_KEY) ?? "") : "",
  );

  // --- State for the login mode (?org= is present) ---
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When ?org= is present, resolve institution name/logo for display
  useEffect(() => {
    if (!orgSlug) return;
    setTenantInfo(null);
    setTenantError(null);
    fetch(`${API_URL}/auth/tenant-info?slug=${encodeURIComponent(orgSlug)}`)
      .then(async (r) => {
        if (!r.ok) {
          setTenantError("Institution not found. Please check your login link.");
          return;
        }
        const data: TenantInfo = await r.json();
        setTenantInfo(data);
        // Remember this slug so next visit auto-populates
        localStorage.setItem(SLUG_STORAGE_KEY, orgSlug);
      })
      .catch(() => {
        setTenantError("Could not reach the server. Please try again.");
      });
  }, [orgSlug]);

  // If user lands on /login with no ?org= but has a stored slug, redirect immediately
  useEffect(() => {
    if (!orgSlug) {
      const stored = localStorage.getItem(SLUG_STORAGE_KEY);
      if (stored) {
        // Pre-populate input (already done via useState initialiser above),
        // but DON'T auto-redirect — let user confirm by pressing Continue.
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Mode 1: user submits their institution slug → navigate to ?org=<slug> */
  function handleFindInstitution(e: FormEvent) {
    e.preventDefault();
    const slug = slugInput.trim();
    if (!slug) return;
    navigate(`/login?org=${encodeURIComponent(slug)}`);
  }

  /** Mode 2: full login with email + password once the tenant slug is known */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgSlug || !tenantInfo) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password, orgSlug);
      const loggedInUser = getAuthUser();
      const defaultRedirect = loggedInUser?.role === "platform_admin" ? "/platform-admin" : "/";
      const redirect = searchParams.get("redirect") ?? defaultRedirect;
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // Render: card shell is shared between both modes
  // ------------------------------------------------------------------
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

        {/* ---- MODE 2: ?org= slug is in the URL ---- */}
        {orgSlug ? (
          <>
            {tenantError ? (
              <p
                style={{
                  margin: "0 0 20px",
                  padding: "10px 12px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  color: "#b91c1c",
                  fontSize: 13,
                }}
              >
                {tenantError}
              </p>
            ) : (
              <p style={{ margin: "0 0 28px", color: "#6b7280", fontSize: 14 }}>
                {tenantInfo ? tenantInfo.name : "Loading…"}
              </p>
            )}

            {!tenantError && (
              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    htmlFor="email"
                    style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}
                  >
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
                  <label
                    htmlFor="password"
                    style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}
                  >
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
                  disabled={isSubmitting || !tenantInfo}
                  style={{
                    padding: "10px 0",
                    background:
                      isSubmitting || !tenantInfo
                        ? "#93c5fd"
                        : "var(--primary-color, #2563EB)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: isSubmitting || !tenantInfo ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            <p
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              Not your institution?{" "}
              <Link
                to="/login"
                style={{ color: "#2563eb" }}
                onClick={() => localStorage.removeItem(SLUG_STORAGE_KEY)}
              >
                Switch
              </Link>
            </p>
          </>
        ) : (
          /* ---- MODE 1: no ?org= — ask for institution code ---- */
          <>
            <p style={{ margin: "0 0 28px", color: "#6b7280", fontSize: 14 }}>
              Enter your institution code to sign in
            </p>
            <form
              onSubmit={handleFindInstitution}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="slugInput"
                  style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}
                >
                  Institution code
                </label>
                <input
                  id="slugInput"
                  type="text"
                  required
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  placeholder="e.g. kti"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                    outline: "none",
                  }}
                  autoComplete="off"
                  autoFocus
                />
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  Your institution code is provided by your administrator.
                </span>
              </div>

              <button
                type="submit"
                style={{
                  padding: "10px 0",
                  background: "var(--primary-color, #2563EB)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                Continue
              </button>
            </form>
          </>
        )}

        <p
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          <Link to="/forgot-password" style={{ color: "#2563eb" }}>
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}

