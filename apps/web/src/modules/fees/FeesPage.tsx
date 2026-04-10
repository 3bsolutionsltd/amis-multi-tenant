import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getFeeSummary,
  getFeeTransactions,
  type FeeSummary,
  type Transaction,
} from "./fees.api";
import { listStudents, type Student } from "../students/students.api";
import {
  ensureGlobalCss,
  PageHeader,
  StatCard,
  Card,
  DataTable,
  TR,
  TD,
  PrimaryBtn,
  SecondaryBtn,
  EmptyState,
  Badge,
} from "../../lib/ui";

type BadgeColor = "green" | "yellow" | "red";
const STATUS_COLOR: Record<string, BadgeColor> = {
  PAID: "green",
  PARTIAL: "yellow",
  OWING: "red",
};

function FeeSummaryCards({ summary }: { summary: FeeSummary }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      <StatCard
        label="Total Due"
        value={`UGX ${summary.totalDue.toLocaleString()}`}
        accent="#2563eb"
      />
      <StatCard
        label="Total Paid"
        value={`UGX ${summary.totalPaid.toLocaleString()}`}
        accent="#16a34a"
      />
      <StatCard
        label="Balance"
        value={`UGX ${summary.balance.toLocaleString()}`}
        accent={summary.balance > 0 ? "#dc2626" : "#16a34a"}
      />
      <Card padding="16px 20px">
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 6,
          }}
        >
          Status
        </div>
        <Badge
          label={summary.badge}
          color={STATUS_COLOR[summary.badge] ?? "gray"}
        />
      </Card>
    </div>
  );
}

export function FeesPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prefillId = params.get("student_id");
  const prefillName = params.get("student_name");

  const [search, setSearch] = useState(prefillName ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    prefillId,
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

  const { data: txnResult, isLoading: txnLoading } = useQuery({
    queryKey: ["feeTransactions", selectedStudentId],
    queryFn: () => getFeeTransactions(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const transactions: Transaction[] = txnResult?.rows ?? [];

  const selectedStudent = students?.find((s) => s.id === selectedStudentId);

  function selectStudent(student: Student) {
    setSelectedStudentId(student.id);
    setSearch(`${student.first_name} ${student.last_name}`);
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn onClick={() => navigate("/finance/import")}>
              ⬆ Import CSV
            </SecondaryBtn>
            {selectedStudentId && (
              <PrimaryBtn
                onClick={() => {
                  const name = selectedStudent
                    ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                    : (prefillName ?? "");
                  navigate(
                    `/finance/entry?student_id=${selectedStudentId}&student_name=${encodeURIComponent(name)}`,
                  );
                }}
              >
                + Record Payment
              </PrimaryBtn>
            )}
          </div>
        }
      />

      {/* Student search */}
      <Card padding="20px 24px" style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            marginBottom: 10,
          }}
        >
          Search student
        </div>
        <div style={{ position: "relative", maxWidth: 440 }}>
          <input
            placeholder="Type student name (min 2 chars)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedStudentId && e.target.value === "")
                setSelectedStudentId(null);
            }}
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1px solid #d1d5db",
              borderRadius: 7,
              fontSize: 14,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          {students && !selectedStudent && students.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
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
                    padding: "10px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 14,
                    color: "#111827",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "#f0f9ff")
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
      </Card>

      {!selectedStudentId && (
        <EmptyState
          icon="💰"
          title="No student selected"
          description="Search for a student above to view their fee records."
        />
      )}

      {selectedStudentId && selectedStudent && (
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 16,
            }}
          >
            {selectedStudent.first_name} {selectedStudent.last_name}
          </div>

          {summary && <FeeSummaryCards summary={summary} />}

          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 12,
            }}
          >
            Payment History
          </div>

          <DataTable
            headers={["Date", "Amount", "Currency", "Reference", "Source"]}
            isLoading={txnLoading}
            isEmpty={!txnLoading && transactions.length === 0}
            emptyIcon="💳"
            emptyTitle="No payments recorded"
            emptyDescription='Click "+ Record Payment" to add the first.'
            colCount={5}
          >
            {transactions.map((txn) => (
              <TR key={txn.id}>
                <TD muted>{new Date(txn.paid_at).toLocaleDateString()}</TD>
                <TD>
                  <span style={{ fontWeight: 600 }}>
                    {txn.amount.toLocaleString()}
                  </span>
                </TD>
                <TD muted>{txn.currency}</TD>
                <TD muted>{txn.reference ?? "—"}</TD>
                <TD muted>{txn.source}</TD>
              </TR>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
