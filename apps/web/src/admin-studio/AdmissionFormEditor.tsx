import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createDraft, getConfigStatus, publishConfig } from "./admin-studio.api";

/* ------------------------------------------------------------------ types */

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "textarea";
  visible: boolean;
  order: number;
  description: string;
  options?: string[];
}

/* ---------------------------------------------------------------- constants */

const ALL_FIELDS: Omit<FieldDef, "visible" | "order">[] = [
  { key: "full_name",          label: "Full Name",              type: "text",     description: "Applicant's full legal name" },
  { key: "date_of_birth",      label: "Date of Birth",          type: "date",     description: "Applicant's date of birth" },
  { key: "gender",             label: "Gender",                 type: "select",   description: "Gender selection", options: ["Male", "Female", "Other"] },
  { key: "phone",              label: "Phone Number",           type: "text",     description: "Contact phone number" },
  { key: "email",              label: "Email Address",          type: "text",     description: "Applicant's email address" },
  { key: "nin",                label: "National ID (NIN)",      type: "text",     description: "National Identification Number" },
  { key: "district",           label: "District of Origin",     type: "text",     description: "Applicant's home district" },
  { key: "nationality",        label: "Nationality",            type: "text",     description: "Nationality / country of origin" },
  { key: "programme_choice",   label: "Programme Choice",       type: "select",   description: "Chosen programme of study (from programmes list)" },
  { key: "previous_school",    label: "Previous School",        type: "text",     description: "Last attended school name" },
  { key: "previous_award",     label: "Previous Qualification", type: "text",     description: "Last qualification obtained (e.g. UCE, UACE)" },
  { key: "year_of_completion",  label: "Year of Completion",    type: "text",     description: "Year the previous qualification was obtained" },
  { key: "sponsorship_type",   label: "Sponsorship Type",       type: "select",   description: "Funding source", options: ["Government", "Private", "Sponsored", "Other"] },
  { key: "guardian_name",      label: "Guardian/Parent Name",   type: "text",     description: "Name of parent or guardian" },
  { key: "guardian_phone",     label: "Guardian Phone",         type: "text",     description: "Guardian/parent contact phone" },
  { key: "statement",          label: "Personal Statement",     type: "textarea", description: "Applicant's personal statement or motivation" },
];

const REQUIRED_KEYS = new Set(["full_name", "programme_choice"]);

/* ---------------------------------------------------------------- styles */

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGreen: React.CSSProperties = {
  padding: "10px 22px",
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

/* ---------------------------------------------------------------- component */

export function AdmissionFormEditor() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);

  useEffect(() => {
    getConfigStatus()
      .then((s) => {
        const payload = s.draft ?? s.published ?? {};
        setFullPayload(payload as Record<string, unknown>);
        const saved: FieldDef[] = (payload as any)?.forms?.admissions?.fields ?? [];
        setFields(initFields(saved));
      })
      .catch(() => setFields(initFields([])))
      .finally(() => setLoading(false));
  }, []);

  function initFields(saved: FieldDef[]): FieldDef[] {
    const savedMap = new Map(saved.map((f) => [f.key, f]));
    return ALL_FIELDS.map((def, i) => ({
      ...def,
      visible: savedMap.has(def.key) ? savedMap.get(def.key)!.visible : true,
      order: savedMap.get(def.key)?.order ?? i,
    })).sort((a, b) => a.order - b.order);
  }

  function toggle(key: string) {
    if (REQUIRED_KEYS.has(key)) return;
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, visible: !f.visible } : f)));
    setSavedMsg(null);
  }

  function move(key: string, dir: "up" | "down") {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.key === key);
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
    setSavedMsg(null);
  }

  function buildUpdated() {
    return {
      ...fullPayload,
      forms: {
        ...((fullPayload as any).forms ?? {}),
        admissions: { fields },
      },
    };
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
      setError("Failed to save changes");
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
      setFullPayload(updated);
      setSavedMsg("published");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["config/status"] });
    } catch {
      setError("Failed to save and publish");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p style={{ color: "#6b7280" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admission Application Form</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Choose which fields appear on the student admission application form. Reorder them with the arrows.
        Changes are saved as a draft — publish when ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fields.map((field, idx) => {
          const isRequired = REQUIRED_KEYS.has(field.key);
          return (
            <div
              key={field.key}
              style={{
                ...cardStyle,
                opacity: field.visible ? 1 : 0.55,
                borderColor: field.visible ? "#93c5fd" : "#e2e8f0",
                background: field.visible ? "#eff6ff" : "#f8fafc",
              }}
            >
              {/* Visibility toggle */}
              <div
                onClick={() => toggle(field.key)}
                title={isRequired ? "Required — cannot be hidden" : field.visible ? "Click to hide" : "Click to show"}
                style={{
                  width: 36, height: 20, borderRadius: 10,
                  background: field.visible ? "#2563eb" : "#d1d5db",
                  position: "relative", cursor: isRequired ? "not-allowed" : "pointer", flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.15s",
                  left: field.visible ? 18 : 2,
                }} />
              </div>

              {/* Label + description */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                  {field.label}
                  {isRequired && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#dc2626", fontWeight: 700 }}>required</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{field.description}</div>
              </div>

              {/* Type badge */}
              <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                {field.type}
              </span>

              {/* Reorder arrows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() => move(field.key, "up")}
                  disabled={idx === 0}
                  style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#cbd5e1" : "#64748b", fontSize: 14, lineHeight: 1, padding: "1px 4px" }}
                  title="Move up"
                >▲</button>
                <button
                  onClick={() => move(field.key, "down")}
                  disabled={idx === fields.length - 1}
                  style={{ background: "none", border: "none", cursor: idx === fields.length - 1 ? "default" : "pointer", color: idx === fields.length - 1 ? "#cbd5e1" : "#64748b", fontSize: 14, lineHeight: 1, padding: "1px 4px" }}
                  title="Move down"
                >▼</button>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginTop: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginTop: 16, fontSize: 13, fontWeight: 600 }}>
          {savedMsg === "draft" ? "✓ Saved as draft — click Save & Publish to go live." : "✓ Published! Form configuration is now live."}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={handleSave} disabled={saving || publishing} style={{ ...btnPrimary, background: saving ? "#93c5fd" : "#2563eb", cursor: saving || publishing ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button onClick={handleSaveAndPublish} disabled={saving || publishing} style={{ ...btnGreen, background: publishing ? "#4ade80" : "#16a34a", cursor: saving || publishing ? "not-allowed" : "pointer" }}>
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        {fields.filter((f) => f.visible).length} of {fields.length} fields visible
      </p>
    </div>
  );
}
