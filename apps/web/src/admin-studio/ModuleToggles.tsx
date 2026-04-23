import { useState, useEffect } from "react";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";
import { useQueryClient } from "@tanstack/react-query";

interface ModuleFlags {
  [key: string]: boolean;
}

const MODULE_GROUPS: Array<{ group: string; modules: Array<{ key: string; label: string; description: string }> }> = [
  {
    group: "Core",
    modules: [
      { key: "students",    label: "Students",         description: "Student records, profiles and management" },
      { key: "admissions",  label: "Admissions",       description: "Application intake and processing" },
      { key: "finance",     label: "Finance / Fees",   description: "Fee structures, payments and reconciliation" },
    ],
  },
  {
    group: "Academic",
    modules: [
      { key: "marks",       label: "Marks & Grades",   description: "Mark entry, bulk entry and grade processing" },
      { key: "results",     label: "Results & Transcripts", description: "Term results, slips and transcripts" },
      { key: "timetable",   label: "Timetable",        description: "Class schedule management" },
      { key: "attendance",  label: "Attendance",       description: "Student attendance tracking" },
      { key: "clearance",   label: "Clearance",        description: "Student clearance and debt tracking" },
    ],
  },
  {
    group: "Staff & Training",
    modules: [
      { key: "staff",               label: "Staff / HR",             description: "Staff profiles, departments and HR records" },
      { key: "industrial-training", label: "Industrial Training",    description: "Student industrial attachment records" },
      { key: "field-placements",    label: "Field Placements",       description: "Student field placement assignments" },
    ],
  },
  {
    group: "Reports & Analytics",
    modules: [
      { key: "analytics",   label: "Analytics Dashboard",  description: "Key metrics and enrolment analytics" },
      { key: "reports",     label: "Reports",              description: "IT reports, class lists, NCHE enrollment, evaluations" },
      { key: "alumni",      label: "Alumni",               description: "Graduate tracking and alumni records" },
    ],
  },
];

const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

export function ModuleToggles() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [modules, setModules] = useState<ModuleFlags>(() =>
    Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, true]))
  );

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        const payload =
          (status.draft?.payload as Record<string, unknown>) ??
          (status.published?.payload as Record<string, unknown>) ??
          {};
        setFullPayload(payload);
        const m = (payload.modules ?? {}) as Record<string, unknown>;
        setModules(
          Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, m[k] !== false]))
        );
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
    setSavedMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = { ...fullPayload, modules: { ...modules } };
      await createDraft(updated);
      setFullPayload(updated);
      setSavedMsg("draft");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["config/status"] });
    } catch {
      setError("Failed to save module settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = { ...fullPayload, modules: { ...modules } };
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

  const isBusy = saving || publishing;
  const enabledCount = Object.values(modules).filter(Boolean).length;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#0f172a" }}>
          Module Toggles
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          Enable or disable application modules. Only enabled modules appear in
          navigation and are accessible to users.
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <span style={{ padding: "4px 12px", background: "#dcfce7", color: "#15803d", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {enabledCount} enabled
        </span>
        <span style={{ padding: "4px 12px", background: "#f1f5f9", color: "#64748b", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {ALL_MODULE_KEYS.length - enabledCount} disabled
        </span>
      </div>

      {/* Groups */}
      {MODULE_GROUPS.map((group) => (
        <div key={group.group} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#64748b",
            textTransform: "uppercase", letterSpacing: "0.07em",
            marginBottom: 8,
          }}>
            {group.group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {group.modules.map(({ key, label, description }) => {
              const enabled = modules[key] ?? true;
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: enabled ? "#f0fdf4" : "#fafafa",
                    border: `1px solid ${enabled ? "#bbf7d0" : "#e5e7eb"}`,
                    transition: "background 0.15s",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {description}
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
                      width: 44, height: 24, borderRadius: 12,
                      background: enabled ? "#22c55e" : "#d1d5db",
                      position: "relative", cursor: "pointer",
                      transition: "background 0.2s", flexShrink: 0, marginLeft: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#fff", position: "absolute", top: 3,
                        left: enabled ? 23 : 3, transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Error / success */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {savedMsg === "draft"
            ? "✓ Saved as draft — click Save & Publish to go live."
            : "✓ Published! Module settings are now live."}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={isBusy}
          style={{
            padding: "10px 22px", background: saving ? "#93c5fd" : "#2563eb",
            color: "#fff", border: "none", borderRadius: 7,
            fontSize: 14, fontWeight: 600, cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={isBusy}
          style={{
            padding: "10px 22px", background: publishing ? "#4ade80" : "#16a34a",
            color: "#fff", border: "none", borderRadius: 7,
            fontSize: 14, fontWeight: 600, cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
