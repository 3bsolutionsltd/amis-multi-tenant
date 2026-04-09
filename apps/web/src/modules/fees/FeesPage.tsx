import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getFeeSummary, getFeeTransactions, type FeeSummary } from "./fees.api";
import { listStudents, type Student } from "../students/students.api";
import { useConfig } from "../../app/ConfigProvider";

const BADGE_COLORS: Record<string, string> = {
  PAID: "#16a34a",
  PARTIAL: "#d97706",
  OWING: "#dc2626",
};

function SummaryCard({ summary }: { summary: FeeSummary }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 24,
      }}
    >
      {[
        {
          label: "Total Due",
          value: `UGX ${summary.totalDue.toLocaleString()}`,
        },
        {
          label: "Total Paid",
          value: `UGX ${summary.totalPaid.toLocaleString()}`,
        },
        {
          label: "Balance",
          value: `UGX ${summary.balance.toLocaleString()}`,
          negative: summary.balance > 0,
        },
        { label: "Status", value: summary.badge, badge: true },
      ].map(({ label, value, negative, badge }) => (
        <div
          key={label}
          style={{
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: badge
                ? (BADGE_COLORS[value] ?? "#374151")
                : negative
                  ? "#dc2626"
                  : "#111827",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeesPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const { data: students } = useQuery({
    queryKey: ["students-search", search],
    queryFn: () => listStudents({ search: search || undefined }),
    enabled: search.length >= 2,
  });

  const { data: summary } = useQuery({
    queryKey: ["feeSummary", selectedStudentId],
    queryFn: () => getFeeSummary(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const { data: transactions, isLoading: txnLoading } = useQuery({
    queryKey: ["feeTransactions", selectedStudentId],
    queryFn: () => getFeeTransactions(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const selectedStudent = students?.find((s) => s.id === selectedStudentId);

  function selectStudent(student: Student) {
    setSelectedStudentId(student.id);
    setSearch(`${student.first_name} ${student.last_name}`);
  }

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
        <h2 style={{ margin: 0 }}>Fees</h2>
        {selectedStudentId && (
          <button
            onClick={() => navigate("/finance/entry")}
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
            + Record Payment
          </button>
        )}
      </div>

      {/* Student search */}
      <div style={{ marginBottom: 20, position: "relative", maxWidth: 400 }}>
        <input
          placeholder="Search student by name (min 2 chars)…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (selectedStudentId && e.target.value === "") {
              setSelectedStudentId(null);
            }
          }}
          style={{
            width: "100%",
            padding: "9px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        {students && !selectedStudent && students.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 100,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {students.map((student) => (
              <div
                key={student.id}
                onClick={() => selectStudent(student)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 14,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                    "#f9fafb")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                    "")
                }
              >
                {student.first_name} {student.last_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedStudentId && selectedStudent && (
        <div>
          <h3 style={{ marginBottom: 16 }}>
            {selectedStudent.first_name} {selectedStudent.last_name}
          </h3>

          {summary && <SummaryCard summary={summary} />}

          <h4 style={{ marginBottom: 10 }}>Payment History</h4>
          {txnLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}
          {transactions && (
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
                    {["Date", "Amount", "Currency", "Reference", "Source"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 12px",
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "24px 12px",
                          color: "#6b7280",
                          textAlign: "center",
                        }}
                      >
                        No payments recorded.
                      </td>
                    </tr>
                  )}
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {new Date(txn.paid_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {txn.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{txn.currency}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {txn.reference ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {txn.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedStudentId && (
        <p style={{ color: "#6b7280", marginTop: 20 }}>
          Search for a student above to view their fee records.
        </p>
      )}
    </div>
  );
}
