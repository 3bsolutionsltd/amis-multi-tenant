import { useState, useEffect } from "react";
import { getConfigStatus, createDraft } from "./admin-studio.api";
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = {
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
      await createDraft(updated);
      setFullPayload(updated);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to save branding changes");
    } finally {
      setSaving(false);
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

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 24px",
            background: saving ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save as Draft"}
        </button>
        {success && (
          <span style={{ color: "#16a34a", fontSize: 13 }}>
            Saved! Publish from Config Editor to go live.
          </span>
        )}
        {error && <span style={{ color: "#b91c1c", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}
