import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listApplications } from "./admissions.api";
import { useConfig } from "../../app/ConfigProvider";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];

const STATE_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#2563eb",
  UNDER_REVIEW: "#d97706",
  COMMITTEE_REVIEW: "#7c3aed",
  APPROVED_GOVT: "#16a34a",
  APPROVED_PRIVATE: "#16a34a",
  REJECTED: "#dc2626",
  ENROLLED: "#0891b2",
};

function StateBadge({ state }: { state: string | null }) {
  const color = state ? (STATE_COLORS[state] ?? "#6b7280") : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: color,
        whiteSpace: "nowrap",
      }}
    >
      {state ?? "—"}
    </span>
  );
}

export function AdmissionsListPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [intake, setIntake] = useState("");
  const [programme, setProgramme] = useState("");
  const [currentState, setCurrentState] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", { intake, programme, currentState }],
    queryFn: () =>
      listApplications({
        intake: intake || undefined,
        programme: programme || undefined,
        current_state: currentState || undefined,
      }),
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0 }}>Admissions</h2>
        <button
          onClick={() => navigate("/admissions/new")}
          style={{
            backgroundColor: primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + New Application
        </button>
      </div>

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}
      >
        <input
          placeholder="Intake (e.g. 2026/2027)"
          value={intake}
          onChange={(e) => setIntake(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 180,
          }}
        />
        <select
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All Programmes</option>
          {PROGRAMMES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          placeholder="State (e.g. SUBMITTED)"
          value={currentState}
          onChange={(e) => setCurrentState(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 160,
          }}
        />
      </div>

      {isLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && (
        <p style={{ color: "#dc2626" }}>
          Failed to load applications. Please try again.
        </p>
      )}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {[
                  "Name",
                  "Programme",
                  "Intake",
                  "Sponsorship",
                  "State",
                  "Applied",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "24px 12px",
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                    No applications found.
                  </td>
                </tr>
              )}
              {data.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/admissions/${app.id}`)}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                  onMouseEnter={(e) =>
                    ((
                      e.currentTarget as HTMLTableRowElement
                    ).style.backgroundColor = "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    ((
                      e.currentTarget as HTMLTableRowElement
                    ).style.backgroundColor = "")
                  }
                >
                  <td style={{ padding: "10px 12px" }}>
                    {app.first_name} {app.last_name}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{app.programme}</td>
                  <td style={{ padding: "10px 12px" }}>{app.intake}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {app.sponsorship_type ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StateBadge state={app.current_state} />
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
