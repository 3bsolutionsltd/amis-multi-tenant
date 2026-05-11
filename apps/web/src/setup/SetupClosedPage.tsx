/**
 * SetupClosedPage — shown when a user navigates to /setup.
 *
 * Public self-registration is disabled. New VTIs must be provisioned by
 * the platform administrator via /platform-admin/provision.
 */
export function SetupClosedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "48px 40px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Self-registration is closed
        </h1>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 24 }}>
          New institution accounts are created by the AMIS platform administrator.
          Please contact your system administrator to request access.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            background: "#2563eb",
            color: "#fff",
            padding: "10px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Back to Login
        </a>
      </div>
    </div>
  );
}
