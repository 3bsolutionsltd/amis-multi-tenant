import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

interface BrandingValues {
  appName: string;
  logoUrl: string;
  primaryColor: string;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  marginBottom: 4,
  display: "block",
};

export function BrandingEditor() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [values, setValues] = useState<BrandingValues>({
    appName: "AMIS",
    logoUrl: "",
    primaryColor: "#2563EB",
  });

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);

        const branding = (payload.branding ?? {}) as Record<string, unknown>;
        const theme = (payload.theme ?? {}) as Record<string, unknown>;

        setValues({
          appName: (branding.appName as string) ?? "AMIS",
          logoUrl: (branding.logoUrl as string) ?? "",
          primaryColor: (theme.primaryColor as string) ?? "#2563EB",
        });
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function buildUpdated() {
    return {
      ...fullPayload,
      branding: {
        ...((fullPayload.branding ?? {}) as Record<string, unknown>),
        appName: values.appName,
        logoUrl: values.logoUrl || undefined,
      },
      theme: {
        ...((fullPayload.theme ?? {}) as Record<string, unknown>),
        primaryColor: values.primaryColor,
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
      setError("Failed to save branding changes");
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

  if (loading) return <p style={{ color: "#6b7280" }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Branding &amp; Theme
      </h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Customize the application name, logo, and theme color. Changes are saved
        as a draft — publish from the Config Editor when ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label htmlFor="appName" style={labelStyle}>
            Application Name
          </label>
          <input
            id="appName"
            value={values.appName}
            onChange={(e) =>
              setValues((v) => ({ ...v, appName: e.target.value }))
            }
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="logoUrl" style={labelStyle}>
            Logo URL
          </label>
          <input
            id="logoUrl"
            type="url"
            placeholder="https://..."
            value={values.logoUrl}
            onChange={(e) =>
              setValues((v) => ({ ...v, logoUrl: e.target.value }))
            }
            style={inputStyle}
          />
          {values.logoUrl && (
            <div style={{ marginTop: 8 }}>
              <img
                src={values.logoUrl}
                alt="Logo preview"
                style={{
                  maxHeight: 48,
                  maxWidth: 200,
                  objectFit: "contain",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: 4,
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="primaryColor" style={labelStyle}>
            Primary Color
          </label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              id="primaryColor"
              type="color"
              value={values.primaryColor}
              onChange={(e) =>
                setValues((v) => ({ ...v, primaryColor: e.target.value }))
              }
              style={{ width: 48, height: 36, border: "none", cursor: "pointer" }}
            />
            <input
              value={values.primaryColor}
              onChange={(e) =>
                setValues((v) => ({ ...v, primaryColor: e.target.value }))
              }
              pattern="^#[0-9A-Fa-f]{6}$"
              style={{ ...inputStyle, width: 120 }}
            />
            <div
              style={{
                width: 80,
                height: 36,
                borderRadius: 6,
                background: values.primaryColor,
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginTop: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginTop: 16, fontSize: 13, fontWeight: 600 }}>
          {savedMsg === "draft" ? "✓ Saved as draft — click Save & Publish to go live." : "✓ Published! Branding changes are now live."}
        </div>
      )}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving || publishing}
          style={{
            padding: "10px 22px",
            background: saving ? "#93c5fd" : "#2563eb",
            color: "#fff", border: "none", borderRadius: 7,
            fontSize: 14, fontWeight: 600,
            cursor: saving || publishing ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={saving || publishing}
          style={{
            padding: "10px 22px",
            background: publishing ? "#4ade80" : "#16a34a",
            color: "#fff", border: "none", borderRadius: 7,
            fontSize: 14, fontWeight: 600,
            cursor: saving || publishing ? "not-allowed" : "pointer",
          }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
