import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ApiError } from "../lib/apiFetch";
import { getAuthUser } from "../lib/auth";

const APP_NAME = "AMIS";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ---- shared input style with focus ring ----
const baseInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
  background: "#fff",
  color: "#111827",
};

function LabeledInput(props: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label htmlFor={props.id} style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...baseInput,
          borderColor: focused ? "var(--primary-color, #2563EB)" : "#d1d5db",
          boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.12)" : "none",
        }}
      />
      {props.hint && <span style={{ fontSize: 12, color: "#9ca3af" }}>{props.hint}</span>}
    </div>
  );
}

const SLUG_STORAGE_KEY = "amis_tenant_slug";

interface TenantInfo {
  name: string;
  logoUrl: string | null;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orgSlug = searchParams.get("org")?.trim() ?? "";

  const [slugInput, setSlugInput] = useState(
    () => !orgSlug ? (localStorage.getItem(SLUG_STORAGE_KEY) ?? "") : "",
  );

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

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
        localStorage.setItem(SLUG_STORAGE_KEY, orgSlug);
      })
      .catch(() => {
        setTenantError("Could not reach the server. Please try again.");
      });
  }, [orgSlug]);

  useEffect(() => {
    if (!orgSlug) {
      localStorage.getItem(SLUG_STORAGE_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFindInstitution(e: FormEvent) {
    e.preventDefault();
    const slug = slugInput.trim();
    if (!slug) return;
    navigate(`/login?org=${encodeURIComponent(slug)}`);
  }

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

  // ---------------------------------------------------------------
  // Layout: left branding panel + right form card
  // ---------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ===== LEFT: branding panel ===== */}
      <div
        style={{
          display: "none",
          // shown on md+ via inline media-query workaround (handled via class below)
        }}
        className="login-brand-panel"
      >
        <style>{`
          @media (min-width: 768px) {
            .login-brand-panel {
              display: flex !important;
              flex-direction: column;
              justify-content: center;
              align-items: flex-start;
              width: 45%;
              min-height: 100vh;
              background: linear-gradient(145deg, var(--primary-color, #2563EB) 0%, #1e40af 100%);
              padding: 60px 56px;
              box-sizing: border-box;
              color: #fff;
            }
          }
          .login-input-pw { position: relative; }
          .login-input-pw input { padding-right: 42px !important; }
          .login-input-pw button {
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; cursor: pointer; color: #9ca3af;
            font-size: 16px; line-height: 1; padding: 2px;
          }
          .login-submit-btn {
            width: 100%;
            padding: 11px 0;
            background: var(--primary-color, #2563EB);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 6px;
            transition: opacity 0.15s, box-shadow 0.15s;
          }
          .login-submit-btn:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
          .login-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .login-error {
            padding: 10px 12px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 7px;
            color: #b91c1c;
            font-size: 13px;
            margin: 0;
          }
          .login-tenant-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: #eff6ff; border: 1px solid #bfdbfe;
            border-radius: 20px; padding: 4px 12px;
            font-size: 13px; font-weight: 500; color: #1d4ed8;
            margin-bottom: 24px;
          }
        `}</style>

        {/* Logo / App name */}
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, marginBottom: 16 }}>
          {APP_NAME}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
          Academic<br />Management<br />Information System
        </h1>
        <p style={{ fontSize: 15, opacity: 0.75, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
          Manage students, admissions, marks, finance, and more — all in one place.
        </p>

        {/* Decorative dots */}
        <div style={{ marginTop: "auto", display: "flex", gap: 8, paddingTop: 48 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: `rgba(255,255,255,${i === 1 ? 0.9 : 0.3})` }} />
          ))}
        </div>
      </div>

      {/* ===== RIGHT: form panel ===== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: "32px 20px",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            padding: "40px 40px 36px",
            width: "100%",
            maxWidth: 420,
            boxSizing: "border-box",
          }}
        >
          {/* Mobile-only: hide this header on desktop */}
          <style>{`@media (min-width: 768px) { .login-mobile-header { display: none !important; } }`}</style>
          <div className="login-mobile-header" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-color, #2563EB)", marginBottom: 4 }}>
              {APP_NAME}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Academic Management</h2>
          </div>

          {/* ---- MODE 2: ?org= slug present ---- */}
          {orgSlug ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700, color: "#111827" }}>
                  Welcome back
                </h2>
                {tenantError ? (
                  <p className="login-error" style={{ marginTop: 0 }}>{tenantError}</p>
                ) : (
                  <div className="login-tenant-badge">
                    <span>🏫</span>
                    <span>{tenantInfo ? tenantInfo.name : "Loading institution…"}</span>
                  </div>
                )}
              </div>

              {!tenantError && (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <LabeledInput
                    id="email"
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@institution.edu"
                    autoComplete="email"
                    required
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label htmlFor="password" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
                      <Link to="/forgot-password" style={{ fontSize: 12, color: "var(--primary-color, #2563EB)", textDecoration: "none" }}>
                        Forgot password?
                      </Link>
                    </div>
                    <div className="login-input-pw" style={{ position: "relative" }}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        ref={passwordRef}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        style={{ ...baseInput, paddingRight: 42 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-color, #2563EB)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => { setShowPassword((v) => !v); passwordRef.current?.focus(); }}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1, padding: 2 }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>

                  {error && <p className="login-error">{error}</p>}

                  <button type="submit" className="login-submit-btn" disabled={isSubmitting || !tenantInfo}>
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              )}

              <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                Not your institution?{" "}
                <Link
                  to="/login"
                  style={{ color: "var(--primary-color, #2563EB)", fontWeight: 500 }}
                  onClick={() => localStorage.removeItem(SLUG_STORAGE_KEY)}
                >
                  Switch institution
                </Link>
              </p>
            </>
          ) : (
            /* ---- MODE 1: no ?org= — find institution ---- */
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }}>
                  Sign in
                </h2>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                  Enter your institution's code to continue
                </p>
              </div>

              <form onSubmit={handleFindInstitution} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <LabeledInput
                  id="slugInput"
                  label="Institution code"
                  value={slugInput}
                  onChange={setSlugInput}
                  placeholder="e.g. kti"
                  autoComplete="off"
                  autoFocus
                  required
                  hint="Your institution code is provided by your administrator."
                />

                <button type="submit" className="login-submit-btn">
                  Continue →
                </button>
              </form>

              <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                <Link to="/forgot-password" style={{ color: "var(--primary-color, #2563EB)" }}>
                  Forgot password?
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ position: "fixed", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "#d1d5db", pointerEvents: "none" }}>
          {APP_NAME} · Academic Management Information System
        </p>
      </div>
    </div>
  );
}
