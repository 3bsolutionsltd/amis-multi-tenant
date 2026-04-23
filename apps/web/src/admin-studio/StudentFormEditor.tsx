import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  { key: "first_name",        label: "First Name",           type: "text",   description: "Student's first name (required)" },
  { key: "last_name",         label: "Last Name",            type: "text",   description: "Student's last name (required)" },
  { key: "other_name",        label: "Other Name(s)",        type: "text",   description: "Middle name or other names" },
  { key: "date_of_birth",     label: "Date of Birth",        type: "date",   description: "Student's date of birth" },
  { key: "gender",            label: "Gender",               type: "select", description: "Gender selection", options: ["Male", "Female", "Other"] },
  { key: "phone",             label: "Phone Number",         type: "text",   description: "Contact phone number" },
  { key: "email",             label: "Email Address",        type: "text",   description: "Student email address" },
  { key: "nin",               label: "National ID (NIN)",    type: "text",   description: "National Identification Number" },
  { key: "district_of_origin", label: "District of Origin",  type: "text",   description: "Student's home district" },
  { key: "programme",         label: "Programme",            type: "select", description: "Enrolled programme (from programmes list)" },
  { key: "admission_number",  label: "Admission Number",     type: "text",   description: "Unique admission/registration number" },
  { key: "sponsorship_type",  label: "Sponsorship Type",     type: "select", description: "Government, Private, Sponsored", options: ["Government", "Private", "Sponsored", "Other"] },
  { key: "year_of_study",     label: "Year of Study",        type: "select", description: "Current academic year (1–6)" },
  { key: "class_section",     label: "Class Section",        type: "text",   description: "Class section e.g. A, B, Morning" },
];

const REQUIRED_KEYS = new Set(["first_name", "last_name"]);

/* ---------------------------------------------------------------- styles */

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  transition: "border-color 0.15s, background 0.15s",
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

const btnGhost: React.CSSProperties = {
  padding: "10px 18px",
  background: "#f1f5f9",
  color: "#374151",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

/* ---------------------------------------------------------------- component */

export function StudentFormEditor() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const [loading, setLoading] = useState(true);
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* load existing config */
  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);

        const forms = (payload.forms ?? {}) as Record<string, unknown>;
        const students = (forms.students ?? {}) as Record<string, unknown>;
        const savedFields = (students.fields ?? []) as Array<{ key: string; visible?: boolean; order?: number }>;

        // Merge saved fields with ALL_FIELDS definitions
        const merged: FieldDef[] = ALL_FIELDS.map((def, i) => {
          const saved = savedFields.find((f) => f.key === def.key);
          return {
            ...def,
            visible: saved ? (saved.visible !== false) : true,
            order: saved?.order ?? i,
          };
        });
        // Sort by saved order
        merged.sort((a, b) => a.order - b.order);
        setFields(merged);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function toggleField(key: string) {
    if (REQUIRED_KEYS.has(key)) return; // can't disable required fields
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, visible: !f.visible } : f))
    );
    setSavedMsg(null);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setFields((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next.map((f, idx) => ({ ...f, order: idx }));
    });
    setSavedMsg(null);
  }

  function moveDown(i: number) {
    setFields((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next.map((f, idx) => ({ ...f, order: idx }));
    });
    setSavedMsg(null);
  }

  function buildPayload(): Record<string, unknown> {
    const formsPayload = {
      ...((fullPayload.forms ?? {}) as Record<string, unknown>),
      students: {
        ...(((fullPayload.forms ?? {}) as Record<string, unknown>).students ?? {}),
        fields: fields.map(({ key, label, type, visible, order, options }) => ({
          key,
          label,
          type,
          visible,
          order,
          ...(options ? { options } : {}),
        })),
      },
    };
    return { ...fullPayload, forms: formsPayload };
  }

  const saveDraftMut = useMutation({
    mutationFn: () => createDraft(buildPayload()),
    onSuccess: () => {
      setSavedMsg("draft");
      setFullPayload(buildPayload());
      qc.invalidateQueries({ queryKey: ["config/status"] });
    },
    onError: () => setError("Failed to save draft"),
  });

  const savePublishMut = useMutation({
    mutationFn: async () => {
      const built = buildPayload();
      await createDraft(built);
      return publishConfig(role);
    },
    onSuccess: () => {
      setSavedMsg("published");
      setFullPayload(buildPayload());
      qc.invalidateQueries({ queryKey: ["config/status"] });
      qc.invalidateQueries({ queryKey: ["config"] });
    },
    onError: () => setError("Failed to save and publish"),
  });

  const isBusy = saveDraftMut.isPending || savePublishMut.isPending;

  if (loading) return <p style={{ color: "#64748b" }}>Loading student form config…</p>;

  const visible = fields.filter((f) => f.visible);
  const hidden = fields.filter((f) => !f.visible);

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>
          Student Form Fields
        </h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Control which fields appear on the new-student form, and in what order.
          Required fields (First Name, Last Name) cannot be disabled.
        </p>
      </div>

      {/* Summary badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ padding: "4px 12px", background: "#dcfce7", color: "#15803d", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {visible.length} visible
        </span>
        <span style={{ padding: "4px 12px", background: "#f1f5f9", color: "#64748b", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {hidden.length} hidden
        </span>
      </div>

      {/* Field list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {fields.map((f, i) => {
          const isRequired = REQUIRED_KEYS.has(f.key);
          return (
            <div
              key={f.key}
              style={{
                ...cardStyle,
                borderColor: f.visible ? "#bfdbfe" : "#e2e8f0",
                background: f.visible ? "#f0f7ff" : "#fafafa",
                opacity: f.visible ? 1 : 0.65,
              }}
            >
              {/* Order buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  title="Move up"
                  style={{
                    width: 24, height: 20, border: "1px solid #e2e8f0", borderRadius: 4,
                    background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer",
                    color: "#64748b", fontSize: 10, lineHeight: 1,
                  }}
                >▲</button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === fields.length - 1}
                  title="Move down"
                  style={{
                    width: 24, height: 20, border: "1px solid #e2e8f0", borderRadius: 4,
                    background: "#fff", cursor: i === fields.length - 1 ? "not-allowed" : "pointer",
                    color: "#64748b", fontSize: 10, lineHeight: 1,
                  }}
                >▼</button>
              </div>

              {/* Field info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                    {f.label}
                  </span>
                  <code style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>
                    {f.key}
                  </code>
                  <span style={{ fontSize: 11, color: "#94a3b8", background: "#f8fafc", padding: "1px 6px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    {f.type}
                  </span>
                  {isRequired && (
                    <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>
                      required
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {f.description}
                </div>
              </div>

              {/* Toggle */}
              <div
                onClick={() => toggleField(f.key)}
                role="switch"
                aria-checked={f.visible}
                tabIndex={isRequired ? -1 : 0}
                title={isRequired ? "Required — cannot be disabled" : f.visible ? "Hide this field" : "Show this field"}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isRequired) toggleField(f.key);
                }}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: f.visible ? "#2563eb" : "#d1d5db",
                  position: "relative",
                  cursor: isRequired ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  opacity: isRequired ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    position: "absolute", top: 3,
                    left: f.visible ? 23 : 3,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Success */}
      {savedMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {savedMsg === "draft" ? "✓ Saved as draft — publish from Config Editor to go live." : "✓ Published! Student form fields are now live."}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{ ...btnPrimary, opacity: isBusy ? 0.6 : 1, cursor: isBusy ? "not-allowed" : "pointer" }}
          disabled={isBusy}
          onClick={() => { setError(null); setSavedMsg(null); saveDraftMut.mutate(); }}
        >
          {saveDraftMut.isPending ? "Saving…" : "Save as Draft"}
        </button>
        <button
          style={{ ...btnGreen, opacity: isBusy ? 0.6 : 1, cursor: isBusy ? "not-allowed" : "pointer" }}
          disabled={isBusy}
          onClick={() => { setError(null); setSavedMsg(null); savePublishMut.mutate(); }}
        >
          {savePublishMut.isPending ? "Publishing…" : "Save & Publish"}
        </button>
        <button
          style={{ ...btnGhost, opacity: isBusy ? 0.6 : 1, cursor: isBusy ? "not-allowed" : "pointer" }}
          disabled={isBusy}
          onClick={() => {
            setError(null);
            setSavedMsg(null);
            // reset to all visible
            setFields(ALL_FIELDS.map((d, i) => ({ ...d, visible: true, order: i })));
          }}
        >
          Reset to All Visible
        </button>
      </div>
    </div>
  );
}
