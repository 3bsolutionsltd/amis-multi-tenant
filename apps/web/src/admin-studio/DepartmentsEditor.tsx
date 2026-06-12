import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_DEPARTMENTS = [
  "ICT", "Business", "Engineering", "Construction", "Electrical",
  "Automotive", "Hospitality", "Agriculture", "Health Sciences", "Others",
];

const inputSt: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box",
};

export function DepartmentsEditor() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [newDept, setNewDept] = useState("");

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const institution = payload.institution as { departments?: string[] } | undefined;
        const saved = institution?.departments;
        setDepartments(saved && saved.length > 0 ? saved : DEFAULT_DEPARTMENTS);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    const existing = (fullPayload.institution as Record<string, unknown>) ?? {};
    return { ...fullPayload, institution: { ...existing, departments } };
  }

  async function handleSave() {
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      setFullPayload(updated);
      setSavedMsg("draft");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to save departments");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true); setError(null); setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      await publishConfig(role);
      setSavedMsg("published");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to publish departments");
    } finally {
      setPublishing(false);
    }
  }

  function addDept() {
    const d = newDept.trim();
    if (!d || departments.includes(d)) return;
    setDepartments([...departments, d]);
    setNewDept("");
  }

  const chipSt: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6,
    marginBottom: 6, background: "#fff",
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Departments</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        Configure the departments available when creating or editing programmes.
        Defaults ({DEFAULT_DEPARTMENTS.slice(0, 4).join(", ")}, …) are used when none are saved.
      </p>

      <div style={{ marginBottom: 16 }}>
        {departments.map((d) => (
          <div key={d} style={chipSt}>
            <span style={{ flex: 1, fontSize: 14 }}>{d}</span>
            <button
              onClick={() => setDepartments(departments.filter((x) => x !== d))}
              style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: "1", padding: "0 2px" }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDept())}
          placeholder="e.g. Civil Engineering"
          style={{ ...inputSt, flex: 1 }}
        />
        <button
          onClick={addDept}
          style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          Add
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div style={{ padding: "8px 14px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          ✓ {savedMsg === "published" ? "Published!" : "Saved as draft."}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving || publishing}
          style={{ padding: "9px 20px", background: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={saving || publishing}
          style={{ padding: "9px 20px", background: publishing ? "#86efac" : "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: publishing ? "not-allowed" : "pointer" }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
