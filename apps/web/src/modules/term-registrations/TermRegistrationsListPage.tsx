import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listTermRegistrations } from "./term-registrations.api";
import { useConfig } from "../../app/ConfigProvider";

const TERMS = ["Term 1", "Term 2", "Term 3"];

const STATE_COLORS: Record<string, string> = {
  REGISTRATION_STARTED: "#6b7280",
  DOCUMENTS_VERIFIED: "#2563eb",
  FEES_VERIFIED: "#0891b2",
  GUILD_FEES_VERIFIED: "#7c3aed",
  DEAN_ENDORSED: "#db2777",
  HALL_ALLOCATED: "#d97706",
  CATERING_VERIFIED: "#16a34a",
  MEDICAL_CHECKED: "#059669",
  LIBRARY_CARD_ISSUED: "#0284c7",
  ONLINE_REGISTERED: "#4f46e5",
  EXAM_ENROLLED: "#dc2626",
  CLEARANCE_ISSUED: "#15803d",
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

export function TermRegistrationsListPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");
  const [currentState, setCurrentState] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["term-registrations", { academicYear, term, currentState }],
    queryFn: () =>
      listTermRegistrations({
        academic_year: academicYear || undefined,
        term: term || undefined,
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
        <h2 style={{ margin: 0 }}>Term Registrations</h2>
        <button
          onClick={() => navigate("/term-registrations/new")}
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
          + New Registration
        </button>
      </div>

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}
      >
        <input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="Academic year (e.g. 2026/2027)"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 14,
            width: 220,
          }}
        />
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 14,
          }}
        >
          <option value="">All terms</option>
          {TERMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={currentState}
          onChange={(e) => setCurrentState(e.target.value)}
          placeholder="Filter by state"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 14,
            width: 180,
          }}
        />
      </div>

      {isLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && (
        <p style={{ color: "#dc2626" }}>Failed to load registrations.</p>
      )}

      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {[
                "Student",
                "Adm. No.",
                "Programme",
                "Academic Year",
                "Term",
                "State",
                "Created",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
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
                  colSpan={7}
                  style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}
                >
                  No registrations found.
                </td>
              </tr>
            )}
            {data.map((reg) => (
              <tr
                key={reg.id}
                onClick={() => navigate(`/term-registrations/${reg.id}`)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "#f9fafb")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "")
                }
              >
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {reg.first_name} {reg.last_name}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {reg.admission_number ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                  }}
                >
                  {reg.student_programme ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                  }}
                >
                  {reg.academic_year}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                  }}
                >
                  {reg.term}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <StateBadge state={reg.current_state} />
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {new Date(reg.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
