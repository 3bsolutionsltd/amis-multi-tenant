import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiFetch";
import { setTokens, type AuthUser } from "../lib/auth";
import { ApiError } from "../lib/apiFetch";

// ---- shared input style ----
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
          borderColor: focused ? "#6366f1" : "#d1d5db",
          boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
        }}
      />
    </div>
  );
}

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>("/auth/platform-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(res.accessToken, res.refreshToken, res.user);
      navigate("/platform-admin", { replace: true });
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #312e81, #4338ca)",
            padding: "28px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Platform Administration
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "6px 0 0" }}>
            AMIS — Restricted Access
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
          <LabeledInput
            id="email"
            label="Administrator Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="admin@example.com"
            autoComplete="email"
            autoFocus
            required
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="password" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  ...baseInput,
                  paddingRight: 44,
                  borderColor: "#d1d5db",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#9ca3af",
                  padding: 0,
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#b91c1c",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "11px 0",
              background: isSubmitting ? "#a5b4fc" : "linear-gradient(135deg, #4338ca, #6366f1)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              marginTop: 4,
            }}
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>

          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <a
              href="/login"
              style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}
            >
              ← Back to Institution Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
