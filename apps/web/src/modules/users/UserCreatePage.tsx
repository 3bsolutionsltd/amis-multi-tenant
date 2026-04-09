import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser, VALID_ROLES } from "./users.api";
import { useConfig } from "../../app/ConfigProvider";

export function UserCreatePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "registrar" as (typeof VALID_ROLES)[number],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser({
        email: form.email,
        password: form.password,
        role: form.role,
      });
      navigate("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 4,
  };

  return (
    <div style={{ maxWidth: 440 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/users")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>New User</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            style={fieldStyle}
            autoComplete="off"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password *</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            style={fieldStyle}
            autoComplete="new-password"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Role *</label>
          <select
            required
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            style={fieldStyle}
          >
            {VALID_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p
            style={{
              color: "#dc2626",
              backgroundColor: "#fef2f2",
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            backgroundColor: primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 15,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Creating…" : "Create User"}
        </button>
      </form>
    </div>
  );
}
