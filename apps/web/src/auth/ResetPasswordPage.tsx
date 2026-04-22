import { useState, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Reset failed");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
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
            maxWidth: 400,
            width: "100%",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#b91c1c", marginBottom: 16 }}>
            Invalid or missing reset token.
          </p>
          <Link to="/login" style={{ color: "#2563eb" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
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
          Reset Password
        </h1>
        <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14 }}>
          Choose a new password for your account.
        </p>

        {success ? (
          <div>
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
              Your password has been reset successfully.
            </div>
            <Link to="/login" style={{ color: "#2563eb", fontSize: 14 }}>
              Sign in with your new password →
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  outline: "none",
                }}
                autoComplete="new-password"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  outline: "none",
                }}
                autoComplete="new-password"
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
              {loading ? "Saving…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
