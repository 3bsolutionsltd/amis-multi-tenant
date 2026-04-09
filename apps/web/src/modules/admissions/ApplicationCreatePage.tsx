import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApplication } from "./admissions.api";
import { useConfig } from "../../app/ConfigProvider";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];
const SPONSORSHIP_TYPES = ["Government", "Private"];

export function ApplicationCreatePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    programme: "",
    intake: "2026/2027",
    sponsorship_type: "",
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
      const body = {
        first_name: form.first_name,
        last_name: form.last_name,
        programme: form.programme,
        intake: form.intake,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        sponsorship_type: form.sponsorship_type || undefined,
      };
      const result = await createApplication(body);
      navigate(`/admissions/${result.application.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit application",
      );
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

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/admissions")}
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
        <h2 style={{ margin: 0 }}>New Application</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>First Name *</label>
            <input
              required
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Last Name *</label>
            <input
              required
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Date of Birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Gender</label>
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              style={fieldStyle}
            >
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Programme *</label>
            <select
              required
              value={form.programme}
              onChange={(e) => set("programme", e.target.value)}
              style={fieldStyle}
            >
              <option value="">— Select Programme —</option>
              {PROGRAMMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Intake *</label>
            <input
              required
              value={form.intake}
              onChange={(e) => set("intake", e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Sponsorship Type</label>
          <select
            value={form.sponsorship_type}
            onChange={(e) => set("sponsorship_type", e.target.value)}
            style={fieldStyle}
          >
            <option value="">— Select —</option>
            {SPONSORSHIP_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
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
          {saving ? "Submitting…" : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
