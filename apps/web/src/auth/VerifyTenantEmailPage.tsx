import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function VerifyTenantEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    fetch(`${API_URL}/tenants/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data?.message === "Email already verified") {
            setStatus("already");
          } else {
            setStatus("success");
          }
        } else {
          setStatus("error");
          setMessage(data?.message ?? "Verification failed. The link may be invalid or expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Could not connect to the server. Please try again later.");
      });
  }, [token]);

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
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <p style={{ color: "#6b7280", marginBottom: 8 }}>Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: "0 0 12px", color: "#111827" }}>Email Verified</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              Your contact email has been verified successfully. AMIS will use this address for
              important notifications about your institution.
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                background: "#2563eb",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Go to Sign In
            </Link>
          </>
        )}

        {status === "already" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✔️</div>
            <h2 style={{ margin: "0 0 12px", color: "#111827" }}>Already Verified</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              This email address has already been verified.
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                background: "#2563eb",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Go to Sign In
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h2 style={{ margin: "0 0 12px", color: "#111827" }}>Verification Failed</h2>
            <p style={{ color: "#b91c1c", marginBottom: 24 }}>
              {message ?? "The verification link is invalid or has expired."}
            </p>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
              Please contact your AMIS administrator to resend the verification email.
            </p>
            <Link
              to="/login"
              style={{ color: "#2563eb" }}
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
