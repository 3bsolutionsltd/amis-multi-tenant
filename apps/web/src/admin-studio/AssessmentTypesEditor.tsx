import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_ASSESSMENT_TYPES = ["midterm", "end_of_term", "coursework", "practical"];

export function AssessmentTypesEditor() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [types, setTypes] = useState<string[]>(DEFAULT_ASSESSMENT_TYPES);
  const [newType, setNewType] = useState("");

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const saved = payload.assessment_types as string[] | undefined;
        setTypes(saved && saved.length > 0 ? saved : DEFAULT_ASSESSMENT_TYPES);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    return { ...fullPayload, assessment_types: types };
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
      setError("Failed to save assessment types");
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
      setError("Failed to publish assessment types");
    } finally {
      setPublishing(false);
    }
  }

  function addType() {
    const t = newType.trim();
    if (!t || types.includes(t)) return;
    setTypes([...types, t]);
    setNewType("");
  }

  function removeType(t: string) {
    setTypes(types.filter((x) => x !== t));
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        Assessment Types
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        Configure which assessment types are available for mark submissions.
        Defaults ({DEFAULT_ASSESSMENT_TYPES.join(", ")}) are used if none are
        saved.
      </p>

      <div style={{ marginBottom: 16 }}>
        {types.map((t) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              marginBottom: 6,
              background: "#fff",
            }}
          >
            <span style={{ flex: 1, fontSize: 14 }}>{t}</span>
            <button
              onClick={() => removeType(t)}
              style={{
                color: "#ef4444",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                padding: "0 4px",
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {types.length === 0 && (
          <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
            No types configured — defaults will be used.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addType()}
          placeholder="e.g. cat1"
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <button
          onClick={addType}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Add
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "9px 18px",
            background: "#475569",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={publishing}
          style={{
            padding: "9px 18px",
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: publishing ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>

      {savedMsg === "draft" && (
        <p style={{ color: "#2563eb", marginTop: 8, fontSize: 13 }}>
          Saved as draft.
        </p>
      )}
      {savedMsg === "published" && (
        <p style={{ color: "#16a34a", marginTop: 8, fontSize: 13 }}>
          Published successfully.
        </p>
      )}
      {error && (
        <p style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>{error}</p>
      )}
    </div>
  );
}
