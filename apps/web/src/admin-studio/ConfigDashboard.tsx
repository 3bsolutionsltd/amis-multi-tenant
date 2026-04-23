import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getConfigStatus, getConfigAudit, publishConfig } from "./admin-studio.api";
import { Link } from "react-router-dom";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 24,
  marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#0f172a",
  fontFamily: "monospace",
};

export function ConfigDashboard() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";
  const [publishError, setPublishError] = useState<string | null>(null);

  const { data: status, isLoading: sLoad, refetch } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  const { data: audit, isLoading: aLoad } = useQuery({
    queryKey: ["config/audit"],
    queryFn: () => getConfigAudit(5),
    staleTime: 30_000,
  });

  const publishMut = useMutation({
    mutationFn: () => publishConfig(role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      void refetch();
    },
    onError: () => setPublishError("Failed to publish — ensure a draft exists first."),
  });

  if (sLoad || aLoad) return <p style={{ color: "#64748b" }}>Loading…</p>;

  const pub = status?.published ?? null;
  const draft = status?.draft ?? null;
  const payload = (pub?.payload ?? draft?.payload ?? {}) as Record<string, unknown>;
  const branding = (payload.branding ?? {}) as Record<string, string>;
  const theme = (payload.theme ?? {}) as Record<string, string>;
  const modules = (payload.modules ?? {}) as Record<string, boolean>;
  const forms = (payload.forms ?? {}) as Record<string, unknown>;
  const studentFields = ((forms.students ?? {}) as Record<string, unknown>).fields as Array<{ visible?: boolean }> | undefined;
  const visibleFieldCount = studentFields ? studentFields.filter((f) => f.visible !== false).length : null;
  const enabledModules = Object.entries(modules).filter(([, v]) => v !== false).length;

  const QUICK_LINKS = [
    { label: "Institute Profile", to: "/admin-studio/profile", icon: "🏫" },
    { label: "Users & Roles", to: "/admin-studio/users", icon: "👥" },
    { label: "Branding & Theme", to: "/admin-studio/branding", icon: "🎨" },
    { label: "Module Toggles", to: "/admin-studio/modules", icon: "🧩" },
    { label: "Student Form Fields", to: "/admin-studio/student-form", icon: "📋" },
    { label: "Navigation", to: "/admin-studio/navigation", icon: "🗂️" },
    { label: "Workflows", to: "/admin-studio/workflows", icon: "⚙️" },
    { label: "Config Editor (JSON)", to: "/admin-studio/editor", icon: "🛠️" },
  ];

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 24, color: "#0f172a" }}>Admin Studio</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Configure your institute's modules, branding, navigation, and student form.
        </p>
      </div>

      {/* Draft publish CTA */}
      {draft && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
          padding: "16px 20px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 2 }}>
              📝 Unpublished Draft
            </div>
            <div style={{ fontSize: 13, color: "#92400e" }}>
              You have unsaved changes (draft created {new Date(draft.created_at).toLocaleString()}).
              Publish to make them live.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <Link to="/admin-studio/editor" style={{
              padding: "8px 16px", background: "#fff", color: "#374151",
              border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13,
              fontWeight: 600, textDecoration: "none",
            }}>
              Review
            </Link>
            <button
              onClick={() => { setPublishError(null); publishMut.mutate(); }}
              disabled={publishMut.isPending}
              style={{
                padding: "8px 18px", background: "#16a34a", color: "#fff",
                border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700,
                cursor: publishMut.isPending ? "not-allowed" : "pointer",
              }}
            >
              {publishMut.isPending ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        </div>
      )}
      {!pub && !draft && (
        <div style={{
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10,
          padding: "16px 20px", marginBottom: 24,
        }}>
          <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: 4 }}>
            🚀 No config published yet
          </div>
          <div style={{ fontSize: 13, color: "#1d4ed8" }}>
            Use the quick links below to configure your institute, then publish.
            Until published, the app uses default fallback values.
          </div>
        </div>
      )}
      {publishError && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {publishError}
        </div>
      )}

      {/* Quick links */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 10, marginBottom: 28,
      }}>
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px", background: "#fff",
              border: "1px solid #e2e8f0", borderRadius: 10,
              textDecoration: "none", color: "#0f172a",
              fontWeight: 600, fontSize: 14,
            }}
          >
            <span style={{ fontSize: 18 }}>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        {/* Branding */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Branding</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
            {branding.appName ?? "AMIS"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: theme.primaryColor ?? "#2563EB" }} />
            <code style={{ fontSize: 11, color: "#64748b" }}>{theme.primaryColor ?? "#2563EB"}</code>
          </div>
        </div>

        {/* Modules */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Modules</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{enabledModules}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {Object.keys(modules).length === 0 ? "No config — defaults active" : "module(s) enabled"}
          </div>
        </div>

        {/* Student form */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Student Form</div>
          {visibleFieldCount !== null ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{visibleFieldCount}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>field(s) configured</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 2 }}>Not configured</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                <Link to="/admin-studio/student-form" style={{ color: "#2563eb" }}>Configure fields →</Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Published version */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Published Version</h3>
        {pub ? (
          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "10px 16px", margin: 0 }}>
            <dt style={labelStyle}>ID</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{pub.id}</dd>
            <dt style={labelStyle}>Published at</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>
              {pub.published_at ? new Date(pub.published_at).toLocaleString() : "—"}
            </dd>
            <dt style={labelStyle}>Published by</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{pub.published_by ?? "—"}</dd>
          </dl>
        ) : (
          <p style={{ color: "#94a3b8", margin: 0 }}>No published configuration yet.</p>
        )}
      </div>

      {/* Audit log */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Recent Audit (last 5)</h3>
        {audit && audit.length > 0 ? (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["Action", "Performed by", "When"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e2e8f0", fontWeight: 600, color: "#374151" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 4,
                      fontSize: 12, fontWeight: 600,
                      background: entry.action === "published" ? "#dcfce7" : entry.action === "rolled_back" ? "#fee2e2" : "#f1f5f9",
                      color: entry.action === "published" ? "#15803d" : entry.action === "rolled_back" ? "#dc2626" : "#374151",
                    }}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{entry.performed_by}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{new Date(entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#94a3b8", margin: 0 }}>No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}



