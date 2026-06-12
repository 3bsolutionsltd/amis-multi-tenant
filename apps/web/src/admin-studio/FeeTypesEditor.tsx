import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_FEE_TYPES = ["tuition", "examination", "functional", "other"];
const DEFAULT_STUDENT_CATEGORIES = ["all", "boarding", "day"];

const inputSt: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box",
};

export function FeeTypesEditor() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [feeTypes, setFeeTypes] = useState<string[]>(DEFAULT_FEE_TYPES);
  const [studentCategories, setStudentCategories] = useState<string[]>(DEFAULT_STUDENT_CATEGORIES);
  const [newFeeType, setNewFeeType] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const savedFeeTypes = payload.fee_types as string[] | undefined;
        const savedCategories = payload.student_categories as string[] | undefined;
        setFeeTypes(savedFeeTypes && savedFeeTypes.length > 0 ? savedFeeTypes : DEFAULT_FEE_TYPES);
        setStudentCategories(savedCategories && savedCategories.length > 0 ? savedCategories : DEFAULT_STUDENT_CATEGORIES);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    return { ...fullPayload, fee_types: feeTypes, student_categories: studentCategories };
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
      setError("Failed to save fee configuration");
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
      setError("Failed to publish fee configuration");
    } finally {
      setPublishing(false);
    }
  }

  function addFeeType() {
    const t = newFeeType.trim();
    if (!t || feeTypes.includes(t)) return;
    setFeeTypes([...feeTypes, t]);
    setNewFeeType("");
  }

  function addCategory() {
    const c = newCategory.trim();
    if (!c || studentCategories.includes(c)) return;
    setStudentCategories([...studentCategories, c]);
    setNewCategory("");
  }

  const chipSt: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6,
    marginBottom: 6, background: "#fff",
  };
  const removeBtnSt: React.CSSProperties = {
    color: "#ef4444", background: "none", border: "none",
    cursor: "pointer", fontSize: 20, lineHeight: "1", padding: "0 2px",
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ maxWidth: 540 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Fee Types &amp; Student Categories</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
        Configure the fee type labels and student category labels available when building fee structures.
        Defaults are used when none are saved.
      </p>

      {/* Fee Types section */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Fee Types</h3>
        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          Defaults: {DEFAULT_FEE_TYPES.join(", ")}
        </p>
        <div style={{ marginBottom: 12 }}>
          {feeTypes.map((t) => (
            <div key={t} style={chipSt}>
              <span style={{ flex: 1, fontSize: 14 }}>{t}</span>
              <button onClick={() => setFeeTypes(feeTypes.filter((x) => x !== t))} style={removeBtnSt} title="Remove">×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newFeeType}
            onChange={(e) => setNewFeeType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeeType())}
            placeholder="e.g. Boarding Fees"
            style={{ ...inputSt, width: "auto", flex: 1 }}
          />
          <button
            onClick={addFeeType}
            style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Student Categories section */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Student Categories</h3>
        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          Defaults: {DEFAULT_STUDENT_CATEGORIES.join(", ")}
        </p>
        <div style={{ marginBottom: 12 }}>
          {studentCategories.map((c) => (
            <div key={c} style={chipSt}>
              <span style={{ flex: 1, fontSize: 14 }}>{c}</span>
              <button onClick={() => setStudentCategories(studentCategories.filter((x) => x !== c))} style={removeBtnSt} title="Remove">×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
            placeholder="e.g. Resident"
            style={{ ...inputSt, width: "auto", flex: 1 }}
          />
          <button
            onClick={addCategory}
            style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Add
          </button>
        </div>
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
