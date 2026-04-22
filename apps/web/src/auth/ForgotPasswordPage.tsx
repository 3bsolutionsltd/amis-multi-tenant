import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Request failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
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
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          padding: "40px 36px",
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#111827" }}>
          Forgot Password
        </h1>
        <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14 }}>
          Enter your email and we'll send a reset link.
        </p>

        {submitted ? (
          <div
            style={{
              padding: "14px 16px",
              background: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: 6,
              color: "#166534",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            If that email is registered, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              disabled={loading}
              style={{
                padding: "10px 0",
                background: loading ? "#93c5fd" : "var(--primary-color, #2563EB)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#6b7280" }}>
          <Link to="/login" style={{ color: "#2563eb" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
