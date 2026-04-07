import { useQuery } from "@tanstack/react-query";
import { getConfigStatus, getConfigAudit } from "./admin-studio.api";

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
  const { data: status, isLoading: sLoad } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  const { data: audit, isLoading: aLoad } = useQuery({
    queryKey: ["config/audit"],
    queryFn: () => getConfigAudit(5),
    staleTime: 30_000,
  });

  if (sLoad || aLoad) return <p style={{ color: "#64748b" }}>Loading…</p>;

  const pub = status?.published ?? null;
  const draft = status?.draft ?? null;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, color: "#0f172a" }}>
        Config Dashboard
      </h2>

      {/* Published version */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
          Published Version
        </h3>
        {pub ? (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "10px 16px",
              margin: 0,
            }}
          >
            <dt style={labelStyle}>ID</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{pub.id}</dd>

            <dt style={labelStyle}>Published at</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>
              {pub.published_at
                ? new Date(pub.published_at).toLocaleString()
                : "—"}
            </dd>

            <dt style={labelStyle}>Published by</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>
              {pub.published_by ?? "—"}
            </dd>
          </dl>
        ) : (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            No published configuration.
          </p>
        )}
      </div>

      {/* Draft status */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
          Draft Status
        </h3>
        {draft ? (
          <p style={{ margin: 0, color: "#0f172a" }}>
            Draft exists — created{" "}
            <strong>{new Date(draft.created_at).toLocaleString()}</strong>.{" "}
            <a href="/admin-studio/editor" style={{ color: "#2563eb" }}>
              Open Config Editor
            </a>{" "}
            to validate or publish.
          </p>
        ) : (
          <p style={{ color: "#94a3b8", margin: 0 }}>No draft.</p>
        )}
      </div>

      {/* Audit log */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
          Recent Audit (last 5)
        </h3>
        {audit && audit.length > 0 ? (
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  Action
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  Performed by
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td
                    style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          entry.action === "published" ? "#dcfce7" : "#fee2e2",
                        color:
                          entry.action === "published" ? "#15803d" : "#dc2626",
                      }}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td
                    style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}
                  >
                    {entry.performed_by}
                  </td>
                  <td
                    style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}
                  >
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
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
