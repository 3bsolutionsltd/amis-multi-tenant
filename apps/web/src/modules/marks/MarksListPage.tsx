import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listSubmissions } from "./marks.api";
import { useConfig } from "../../app/ConfigProvider";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];

const STATE_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#2563eb",
  HOD_REVIEW: "#d97706",
  APPROVED: "#16a34a",
  PUBLISHED: "#0891b2",
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

export function MarksListPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [programme, setProgramme] = useState("");
  const [intake, setIntake] = useState("");
  const [term, setTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["submissions", { programme, intake, term }],
    queryFn: () =>
      listSubmissions({
        programme: programme || undefined,
        intake: intake || undefined,
        term: term || undefined,
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
        <h2 style={{ margin: 0 }}>Marks</h2>
        <button
          onClick={() => navigate("/marks/new")}
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
          + New Submission
        </button>
      </div>

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}
      >
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
        <input
          placeholder="Term (e.g. Term 1)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 140,
          }}
        />
      </div>

      {isLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && <p style={{ color: "#dc2626" }}>Failed to load submissions.</p>}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {[
                  "Course",
                  "Programme",
                  "Intake",
                  "Term",
                  "State",
                  "Created",
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
                    No submissions found.
                  </td>
                </tr>
              )}
              {data.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => navigate(`/marks/${sub.id}`)}
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
                  <td style={{ padding: "10px 12px" }}>{sub.course_id}</td>
                  <td style={{ padding: "10px 12px" }}>{sub.programme}</td>
                  <td style={{ padding: "10px 12px" }}>{sub.intake}</td>
                  <td style={{ padding: "10px 12px" }}>{sub.term}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <StateBadge state={sub.current_state} />
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                    {new Date(sub.created_at).toLocaleDateString()}
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
