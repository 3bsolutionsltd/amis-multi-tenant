import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";

const ALL_ROLES = ["admin", "registrar", "hod", "instructor", "finance", "principal", "dean"] as const;
type DashRole = typeof ALL_ROLES[number];

interface WidgetDef {
  key: string;
  label: string;
  description: string;
}

const WIDGETS: WidgetDef[] = [
  { key: "total_students", label: "Total Students", description: "Count of enrolled students" },
  { key: "pending_admissions", label: "Pending Admissions", description: "Applications awaiting review" },
  { key: "fees_collected", label: "Fees Collected", description: "Total fees received this term" },
  { key: "fees_outstanding", label: "Fees Outstanding", description: "Unpaid fee balances" },
  { key: "pass_rate", label: "Pass Rate", description: "% students passing this term" },
  { key: "active_staff", label: "Active Staff", description: "Number of active staff members" },
  { key: "recent_activity", label: "Recent Activity", description: "Latest system events log" },
  { key: "announcements", label: "Announcements", description: "Pinned institution notices" },
  { key: "upcoming_calendar", label: "Upcoming Calendar", description: "Next academic events" },
  { key: "course_completion", label: "Course Completion", description: "Courses completed vs planned" },
  { key: "term_results_summary", label: "Term Results Summary", description: "Grade distribution overview" },
  { key: "registration_status", label: "Registration Status", description: "Students registered this term" },
  { key: "quick_links", label: "Quick Links", description: "Shortcuts to common tasks" },
];

const DEFAULT_WIDGETS: Record<DashRole, string[]> = {
  admin: ["total_students", "active_staff", "fees_collected", "pending_admissions", "recent_activity", "announcements"],
  registrar: ["total_students", "pending_admissions", "registration_status", "upcoming_calendar", "recent_activity"],
  hod: ["total_students", "pass_rate", "course_completion", "term_results_summary", "upcoming_calendar"],
  instructor: ["course_completion", "pass_rate", "term_results_summary", "upcoming_calendar", "quick_links"],
  finance: ["fees_collected", "fees_outstanding", "total_students", "recent_activity"],
  principal: ["total_students", "fees_collected", "pass_rate", "active_staff", "announcements", "pending_admissions"],
  dean: ["total_students", "pass_rate", "term_results_summary", "course_completion", "active_staff"],
};

export function DashboardWidgetsEditor() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [selectedRole, setSelectedRole] = useState<DashRole>("admin");
  const [widgetsByRole, setWidgetsByRole] = useState<Record<DashRole, string[]>>(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfigStatus()
      .then((s) => {
        const p = (s.draft ?? s.published ?? {}) as Record<string, unknown>;
        setFullPayload(p);
        const dashboards = (p.dashboards ?? {}) as Record<string, { widgets: string[] }>;
        const loaded = { ...DEFAULT_WIDGETS } as Record<DashRole, string[]>;
        for (const r of ALL_ROLES) {
          if (dashboards[r]?.widgets?.length) {
            loaded[r] = dashboards[r].widgets;
          }
        }
        setWidgetsByRole(loaded);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleWidget(key: string) {
    setWidgetsByRole((prev) => {
      const current = prev[selectedRole];
      const updated = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, [selectedRole]: updated };
    });
    setSavedMsg(null);
  }

  function buildUpdated() {
    const dashboards: Record<string, { widgets: string[] }> = {};
    for (const r of ALL_ROLES) {
      dashboards[r] = { widgets: widgetsByRole[r] };
    }
    return { ...fullPayload, dashboards };
  }

  async function handleSave() {
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      setFullPayload(updated);
      setSavedMsg("draft");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch (e) {
      setError("Failed to save dashboard widgets: " + (e instanceof Error ? e.message : "unknown error"));
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
    } catch (e) {
      setError("Failed to publish dashboard widgets: " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  const activeWidgets = widgetsByRole[selectedRole];
  const enabledCount = activeWidgets.length;

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Dashboard Widgets</h2>
      <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 14 }}>
        Choose which widgets appear on each role's dashboard. Changes apply after publishing.
      </p>

      {/* Role tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: selectedRole === r ? "2px solid #2563eb" : "2px solid transparent",
              background: "none",
              color: selectedRole === r ? "#2563eb" : "#64748b",
              fontWeight: selectedRole === r ? 700 : 400,
              fontSize: 13,
              cursor: "pointer",
              marginBottom: -2,
              borderRadius: "4px 4px 0 0",
            }}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary */}
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        <strong style={{ color: "#0f172a" }}>{enabledCount}</strong> of {WIDGETS.length} widgets enabled for <strong style={{ color: "#0f172a" }}>{selectedRole}</strong>.
      </p>

      {/* Widget grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {WIDGETS.map((w) => {
          const on = activeWidgets.includes(w.key);
          return (
            <label
              key={w.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                border: `1px solid ${on ? "#93c5fd" : "#e2e8f0"}`,
                borderRadius: 8,
                background: on ? "#eff6ff" : "#fff",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleWidget(w.key)}
                style={{ marginTop: 2, accentColor: "#2563eb", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{w.label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{w.description}</div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Actions */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          {savedMsg === "draft" ? "✓ Saved as draft." : "✓ Published!"}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving || publishing}
          style={{ padding: "10px 22px", background: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: saving || publishing ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button
          onClick={handleSaveAndPublish}
          disabled={saving || publishing}
          style={{ padding: "10px 22px", background: publishing ? "#4ade80" : "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: saving || publishing ? "not-allowed" : "pointer" }}
        >
          {publishing ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
