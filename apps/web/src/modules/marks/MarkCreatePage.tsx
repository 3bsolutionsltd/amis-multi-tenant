import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSubmission } from "./marks.api";
import { useConfig } from "../../app/ConfigProvider";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];

export function MarkCreatePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [form, setForm] = useState({
    course_id: "",
    programme: "",
    intake: "2026/2027",
    term: "",
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
      const result = await createSubmission({
        course_id: form.course_id,
        programme: form.programme,
        intake: form.intake,
        term: form.term,
      });
      navigate(`/marks/${result.submission.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create submission",
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

  return (
    <div style={{ maxWidth: 480 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/marks")}
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
        <h2 style={{ margin: 0 }}>New Mark Submission</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Course ID *</label>
          <input
            required
            value={form.course_id}
            onChange={(e) => set("course_id", e.target.value)}
            placeholder="e.g. NCBC101"
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
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

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Intake *</label>
          <input
            required
            value={form.intake}
            onChange={(e) => set("intake", e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Term *</label>
          <input
            required
            value={form.term}
            onChange={(e) => set("term", e.target.value)}
            placeholder="e.g. Term 1"
            style={fieldStyle}
          />
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
          {saving ? "Creating…" : "Create Submission"}
        </button>
      </form>
    </div>
  );
}
