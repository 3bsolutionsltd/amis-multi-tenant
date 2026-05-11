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

interface TenantInfo {
  name: string;
  logoUrl: string | null;
}

export function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill institution code from ?org= query param
  const orgFromUrl = searchParams.get("org")?.trim() ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Optional institution code — only shown when needed
  const [slugInput, setSlugInput] = useState(orgFromUrl);
  const [showSlug, setShowSlug] = useState(!!orgFromUrl);
  // Available slugs returned by backend when user belongs to multiple tenants
  const [availableSlugs, setAvailableSlugs] = useState<string[]>([]);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // OTP step state
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // When a slug is present in the URL, fetch tenant branding
  useEffect(() => {
    if (!orgFromUrl) return;
    fetch(`${API_URL}/auth/tenant-info?slug=${encodeURIComponent(orgFromUrl)}`)
      .then(async (r) => {
        if (!r.ok) return;
        const data: TenantInfo = await r.json();
        setTenantInfo(data);
      })
      .catch(() => {});
  }, [orgFromUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const slug = slugInput.trim() || undefined;
    try {
      const result = await login(email, password, slug);
      if (result.status === "otp_required") {
        setOtpSessionId(result.otpSessionId);
        setOtpCode("");
        setIsSubmitting(false);
        return;
      }
      const loggedInUser = getAuthUser();
      const defaultRedirect = loggedInUser?.role === "platform_admin" ? "/platform-admin" : "/";
      navigate(searchParams.get("redirect") ?? defaultRedirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Multiple tenants matched — show institution code field
        const body = err.body as { tenantSlugs?: string[] };
        const slugs = body?.tenantSlugs ?? [];
        setAvailableSlugs(slugs);
        setShowSlug(true);
        setError("Your email is registered at multiple institutions. Enter your institution code below.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (!otpSessionId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(otpSessionId, otpCode);
      const loggedInUser = getAuthUser();
      const defaultRedirect = loggedInUser?.role === "platform_admin" ? "/platform-admin" : "/";
      navigate(searchParams.get("redirect") ?? defaultRedirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid or expired code. Please try again.");
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
      <style>{`
        @media (min-width: 768px) {
          .login-brand-panel {
            display: flex !important;
            flex-direction: column;
            width: 45%;
            min-height: 100vh;
            background: linear-gradient(145deg, var(--primary-color, #2563EB) 0%, #1e40af 100%);
            padding: 52px 56px;
            box-sizing: border-box;
            color: #fff;
            position: relative;
            overflow: hidden;
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

      {/* ===== LEFT: branding panel ===== */}
      <div style={{ display: "none" }} className="login-brand-panel">
        <div style={{ position: "absolute", top: -100, right: -100, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: 40, left: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ marginBottom: 44, zIndex: 1 }}>
          {tenantInfo?.logoUrl ? (
            <img src={tenantInfo.logoUrl} alt={tenantInfo.name} style={{ height: 52, maxWidth: 180, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎓</div>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{APP_NAME}</span>
            </div>
          )}
        </div>
        <div style={{ zIndex: 1, flex: 1 }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Academic Management<br />Information System
          </h1>
          <p style={{ fontSize: 14, opacity: 0.72, lineHeight: 1.65, maxWidth: 300, margin: "0 0 44px" }}>
            A unified platform for managing your institution — from enrollment to graduation.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {([
              { icon: "👨‍🎓", label: "Students & Admissions", desc: "Manage records, applications and intake" },
              { icon: "📊", label: "Marks & Assessments", desc: "Enter results, view grades and transcripts" },
              { icon: "💳", label: "Finance & Payments", desc: "Fee structures, invoices and collection" },
              { icon: "📅", label: "Academic Calendar", desc: "Terms, academic years and scheduling" },
              { icon: "👔", label: "Staff & HR", desc: "Staff profiles, roles and assignments" },
              { icon: "🏗️", label: "Industrial Training", desc: "Field placements and IT reports" },
              { icon: "📈", label: "Analytics & Reports", desc: "Enrollment stats, fee collection and more" },
              { icon: "🛒", label: "Procurement & Inventory", desc: "Requisitions, orders and stock management" },
            ] as const).map(({ icon, label, desc }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(255,255,255,0.14)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.4, marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ zIndex: 1, paddingTop: 40 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 18 }} />
          <p style={{ margin: 0, fontSize: 12, opacity: 0.45 }}>© {new Date().getFullYear()} {APP_NAME} · Academic Management Information System</p>
        </div>
      </div>

      {/* ===== RIGHT: form panel ===== */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "32px 20px", minHeight: "100vh", boxSizing: "border-box" }}>
        <div style={{ background: "#ffffff", borderRadius: 16, boxShadow: "0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)", padding: "40px 40px 36px", width: "100%", maxWidth: 420, boxSizing: "border-box" }}>

          {/* Mobile-only header */}
          <style>{`@media (min-width: 768px) { .login-mobile-header { display: none !important; } }`}</style>
          <div className="login-mobile-header" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-color, #2563EB)", marginBottom: 4 }}>{APP_NAME}</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Academic Management</h2>
          </div>

          {/* ===== OTP verification step ===== */}
          {otpSessionId ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>🔐</div>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }}>Check your email</h2>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it below to sign in.
                </p>
              </div>
              <form onSubmit={handleOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label htmlFor="otpCode" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>One-time code</label>
                  <input
                    id="otpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    style={{ ...baseInput, fontSize: 28, letterSpacing: 12, textAlign: "center", fontWeight: 700, padding: "12px 16px" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-color, #2563EB)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>This code expires in 10 minutes.</span>
                </div>
                {error && <p className="login-error">{error}</p>}
                <button type="submit" className="login-submit-btn" disabled={isSubmitting || otpCode.length < 6}>
                  {isSubmitting ? "Verifying…" : "Verify code"}
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: 0 }}>
                  Didn't receive it?{" "}
                  <button type="button" onClick={() => { setOtpSessionId(null); setError(null); }} style={{ background: "none", border: "none", color: "var(--primary-color, #2563EB)", cursor: "pointer", fontSize: 12, padding: 0 }}>
                    Go back and try again
                  </button>
                </p>
              </form>
            </>
          ) : (
          /* ===== Credentials step ===== */
          <>
          <div style={{ marginBottom: 28 }}>
            {orgFromUrl ? (
              /* Tenant-specific heading */
              <>
                <div className="login-tenant-badge" style={{ marginBottom: 16 }}>
                  {tenantInfo?.logoUrl ? (
                    <img src={tenantInfo.logoUrl} alt={tenantInfo.name} style={{ width: 20, height: 20, objectFit: "contain", borderRadius: 3 }} />
                  ) : <span>🏫</span>}
                  <span>{tenantInfo ? tenantInfo.name : orgFromUrl.toUpperCase()}</span>
                </div>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }}>Sign in</h2>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Enter your credentials to access your account</p>
              </>
            ) : (
              /* Generic heading */
              <>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" }}>Sign in</h2>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Enter your email and password to continue</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LabeledInput
              id="email"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@institution.edu"
              autoComplete="email"
              autoFocus
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

            {/* Institution code — only shown for multi-tenant disambiguation (409 response).
                If the org is already known from the URL (?org=kti) we don't need it. */}
            {showSlug && !orgFromUrl && (
              <div>
                <LabeledInput
                  id="slugInput"
                  label="Institution code"
                  value={slugInput}
                  onChange={setSlugInput}
                  placeholder="e.g. kti"
                  autoComplete="off"
                  hint="Your institution code was provided at setup."
                />
                {availableSlugs.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {availableSlugs.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlugInput(s)}
                        style={{ padding: "3px 10px", background: slugInput === s ? "#dbeafe" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, fontSize: 12, cursor: "pointer", color: "#374151" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>

            {!showSlug && !orgFromUrl && (
              <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: 0 }}>
                Have an institution code?{" "}
                <button type="button" onClick={() => setShowSlug(true)} style={{ background: "none", border: "none", color: "var(--primary-color, #2563EB)", cursor: "pointer", fontSize: 12, padding: 0 }}>
                  Enter it here
                </button>
              </p>
            )}

            {orgFromUrl && (
              <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: 0 }}>
                Not your institution?{" "}
                <Link to="/login" style={{ color: "var(--primary-color, #2563EB)", fontWeight: 500 }}>Switch institution</Link>
              </p>
            )}
          </form>
          </>
          )}
        </div>

        <p style={{ position: "fixed", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "#d1d5db", pointerEvents: "none" }}>
          {APP_NAME} · Academic Management Information System
        </p>
        <p style={{ position: "fixed", bottom: 36, left: 0, right: 0, textAlign: "center", fontSize: 11 }}>
          <Link to="/platform-login" style={{ color: "#9ca3af", textDecoration: "none" }}>
            Platform Administrator?
          </Link>
        </p>
      </div>
    </div>
  );
}
