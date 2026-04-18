import { useState, useEffect } from "react";
import { getConfigStatus, createDraft } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

interface ModuleFlags {
  students: boolean;
  admissions: boolean;
  finance: boolean;
  [key: string]: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  students: "Students",
  admissions: "Admissions",
  finance: "Finance / Fees",
};

export function ModuleToggles() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [modules, setModules] = useState<ModuleFlags>({
    students: true,
    admissions: true,
    finance: true,
  });

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const m = (payload.modules ?? {}) as Record<string, unknown>;
        setModules({
          students: m.students !== false,
          admissions: m.admissions !== false,
          finance: m.finance !== false,
        });
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = { ...fullPayload, modules: { ...modules } };
      await createDraft(updated);
      setFullPayload(updated);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to save module settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "#6b7280" }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Module Toggles
      </h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Enable or disable application modules. Changes are saved as a draft —
        publish from the Config Editor when ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {Object.entries(modules).map(([key, enabled]) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderRadius: 8,
              background: enabled ? "#f0fdf4" : "#fafafa",
              border: `1px solid ${enabled ? "#bbf7d0" : "#e5e7eb"}`,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {MODULE_LABELS[key] ?? key}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div
              onClick={() => toggle(key)}
              role="switch"
              aria-checked={enabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggle(key);
              }}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: enabled ? "#22c55e" : "#d1d5db",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  left: enabled ? 23 : 3,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </label>
        ))}
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
