import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";
import { C, inputCss } from "../lib/ui";

type Template = "classic" | "modern" | "minimal";

interface ReceiptValues {
  template: Template;
  headerNote: string;
  footerNote: string;
  showBalance: boolean;
}

const TEMPLATES: { value: Template; label: string; description: string }[] = [
  {
    value: "classic",
    label: "Classic",
    description: "Centered institution name, logo, address, and contact details above the receipt title.",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Logo and institution details side-by-side, with a colored accent bar showing the receipt title.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean, compact header with institution name and date only — ideal for narrow prints.",
  },
];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.gray200}`,
  borderRadius: 12,
  padding: 28,
  marginBottom: 24,
};

export function ReceiptTemplateEditor() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [values, setValues] = useState<ReceiptValues>({
    template: "classic",
    headerNote: "",
    footerNote: "",
    showBalance: true,
  });

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const receipt = (payload.receipt ?? {}) as Record<string, unknown>;
        setValues({
          template: (receipt.template as Template) ?? "classic",
          headerNote: (receipt.headerNote as string) ?? "",
          footerNote: (receipt.footerNote as string) ?? "",
          showBalance: receipt.showBalance !== false,
        });
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    return {
      ...fullPayload,
      receipt: {
        template: values.template,
        headerNote: values.headerNote || undefined,
        footerNote: values.footerNote || undefined,
        showBalance: values.showBalance,
      },
    };
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
      setError("Failed to save receipt settings");
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

  if (loading) return <p style={{ color: C.gray400 }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, color: C.gray900 }}>
          Receipt Template
        </h2>
        <p style={{ margin: 0, color: C.gray500, fontSize: 14 }}>
          Choose a receipt layout and set custom text for headers and footers.
          Institution name, address, phone, and logo are pulled from your{" "}
          <a href="/admin-studio/profile" style={{ color: "#2563EB" }}>
            Institute Profile
          </a>
          .
        </p>
      </div>

      {/* Template selector */}
      <div style={cardStyle}>
        <label style={{ ...labelStyle, fontSize: 14, marginBottom: 16 }}>
          Receipt Layout
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TEMPLATES.map((t) => (
            <label
              key={t.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 8,
                border: `2px solid ${values.template === t.value ? "#2563EB" : C.gray200}`,
                background: values.template === t.value ? "#eff6ff" : "#fff",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <input
                type="radio"
                name="template"
                value={t.value}
                checked={values.template === t.value}
                onChange={() => setValues((v) => ({ ...v, template: t.value }))}
                style={{ marginTop: 2, accentColor: "#2563EB" }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.gray900 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  {t.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Custom text */}
      <div style={cardStyle}>
        <label style={{ ...labelStyle, fontSize: 14, marginBottom: 20 }}>
          Custom Text
        </label>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Header Note (optional tagline / subtitle)</label>
          <input
            type="text"
            style={{ ...inputCss, width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. A Centre of Excellence in Technical Education"
            value={values.headerNote}
            onChange={(e) => setValues((v) => ({ ...v, headerNote: e.target.value }))}
          />
          <p style={{ fontSize: 11, color: C.gray400, margin: "4px 0 0" }}>
            Appears below the institution name in the receipt header.
          </p>
        </div>

        <div>
          <label style={labelStyle}>Footer Note</label>
          <input
            type="text"
            style={{ ...inputCss, width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. This is a computer-generated receipt. No signature required."
            value={values.footerNote}
            onChange={(e) => setValues((v) => ({ ...v, footerNote: e.target.value }))}
          />
          <p style={{ fontSize: 11, color: C.gray400, margin: "4px 0 0" }}>
            Replaces the default footer text on every receipt.
          </p>
        </div>
      </div>

      {/* Options */}
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
        <input
          id="showBalance"
          type="checkbox"
          checked={values.showBalance}
          onChange={(e) => setValues((v) => ({ ...v, showBalance: e.target.checked }))}
          style={{ width: 16, height: 16, accentColor: "#2563EB" }}
        />
        <div>
          <label
            htmlFor="showBalance"
            style={{ fontWeight: 600, fontSize: 14, color: C.gray900, cursor: "pointer" }}
          >
            Show Outstanding Balance
          </label>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray500 }}>
            Display the student's remaining balance on the receipt.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}
      {savedMsg === "draft" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Draft saved — click <strong>Save &amp; Publish</strong> to make changes live.
        </div>
      )}
      {savedMsg === "published" && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            color: "#15803d",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ✅ Receipt template published successfully.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => void handleSave()}
          disabled={saving || publishing}
          style={{
            padding: "10px 22px",
            background: "#fff",
            border: `1px solid ${C.gray300}`,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: C.gray700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={() => void handleSaveAndPublish()}
          disabled={saving || publishing}
          style={{
            padding: "10px 22px",
            background: "#2563EB",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            cursor: publishing ? "not-allowed" : "pointer",
          }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
