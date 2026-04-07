import { useQuery } from "@tanstack/react-query";
import { getConfigStatus } from "./admin-studio.api";

interface WorkflowTransition {
  action: string;
  from: string;
  to: string;
}

interface WorkflowDef {
  key?: string;
  initial_state: string;
  states: string[];
  transitions: WorkflowTransition[];
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 24,
  marginBottom: 24,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 14px",
  border: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#374151",
  background: "#f1f5f9",
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 14px",
  border: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#0f172a",
};

export function WorkflowViewer() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  if (isLoading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  const payload =
    status?.published?.payload ??
    status?.draft?.payload ??
    ({} as Record<string, unknown>);
  const workflows = (payload.workflows ?? {}) as Record<string, WorkflowDef>;
  const keys = Object.keys(workflows);

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, color: "#0f172a" }}>
        Workflow Viewer
      </h2>

      {keys.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ color: "#94a3b8", margin: 0 }}>
            No workflows defined in the current config.
          </p>
        </div>
      ) : (
        keys.map((key) => {
          const wf = workflows[key];
          return (
            <div key={key} style={cardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 12, color: "#0f172a" }}>
                {key}
              </h3>

              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Initial state:{" "}
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 4,
                    background: "#dbeafe",
                    color: "#1d4ed8",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {wf.initial_state}
                </span>
              </p>

              {/* States */}
              <h4
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                States
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                {(wf.states ?? []).map((s) => (
                  <span
                    key={s}
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 4,
                      background:
                        s === wf.initial_state ? "#dbeafe" : "#f1f5f9",
                      color: s === wf.initial_state ? "#1d4ed8" : "#374151",
                      fontSize: 12,
                      fontWeight: 500,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Transitions table */}
              <h4
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Transitions
              </h4>
              {(wf.transitions ?? []).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>
                  No transitions defined.
                </p>
              ) : (
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Action</th>
                      <th style={thStyle}>From</th>
                      <th style={thStyle}>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wf.transitions ?? []).map((t, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              background: "#f8fafc",
                              padding: "1px 6px",
                              borderRadius: 3,
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {t.action}
                          </span>
                        </td>
                        <td style={tdStyle}>{t.from}</td>
                        <td style={tdStyle}>{t.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
