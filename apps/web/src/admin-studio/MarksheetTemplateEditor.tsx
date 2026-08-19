import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

const TEMPLATES = [
  { key: "master", label: "Master Marksheet", description: "Full detail — every assessment column, for record-keeping." },
  { key: "uvtab", label: "UVTAB Marksheet", description: "Standard UVTAB Course Work Assessment Form layout (default)." },
  { key: "instructor", label: "Instructor Marksheet", description: "Detailed view for instructors entering/reviewing marks." },
  { key: "registrar", label: "Registrar Marksheet", description: "Validation view for the registrar (no signature column)." },
  { key: "principal", label: "Principal Marksheet", description: "Summary only — total and grade per student." },
] as const;

export function MarksheetTemplateEditor() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [defaultTemplate, setDefaultTemplate] = useState("uvtab");

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        setDefaultTemplate((payload.marksheet_default_template as string) || "uvtab");
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    return { ...fullPayload, marksheet_default_template: defaultTemplate };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      setFullPayload(updated);
      setSavedMsg("draft");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to save marksheet template setting");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      await publishConfig(role);
      setSavedMsg("published");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to publish marksheet template setting");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        Marksheet Templates
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        Choose which marksheet layout is used by default when viewing or
        exporting a course's marksheet. Users can still switch templates when
        viewing a marksheet.
      </p>

      <div style={{ marginBottom: 24 }}>
        {TEMPLATES.map((t) => (
          <label
            key={t.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 14px",
              border: `1px solid ${defaultTemplate === t.key ? "#2563eb" : "#e2e8f0"}`,
              background: defaultTemplate === t.key ? "#eff6ff" : "#fff",
              borderRadius: 8,
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="marksheet_default_template"
              value={t.key}
              checked={defaultTemplate === t.key}
              onChange={() => setDefaultTemplate(t.key)}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                {t.label}
                {t.key === "uvtab" && (
                  <span style={{ marginLeft: 8, fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                    SYSTEM DEFAULT
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{t.description}</div>
            </div>
          </label>
        ))}
      </div>

      {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {savedMsg === "draft" && (
        <div style={{ color: "#15803d", fontSize: 13, marginBottom: 12 }}>Saved as draft.</div>
      )}
      {savedMsg === "published" && (
        <div style={{ color: "#15803d", fontSize: 13, marginBottom: 12 }}>Published.</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={publishing}
          style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
