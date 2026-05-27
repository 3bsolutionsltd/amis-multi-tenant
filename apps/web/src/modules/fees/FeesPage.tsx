import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getFeeSummary,
  getFeeTransactions,
  getFeeOverview,
  getFeeDefaulters,
  type FeeSummary,
  type Transaction,
  type FeeOverview,
  type Defaulter,
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
  SectionLabel,
  Spinner,
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

function FeeStructureBreakdown({ summary }: { summary: FeeSummary }) {
  if (summary.feeStructures.length === 0) {
    return (
      <Card padding="16px 20px" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
          No active fee structure matched this student. Using configured default total due.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel>Applicable Fee Structure</SectionLabel>
      <DataTable headers={["Fee", "Category", "Period", "Amount"]} colCount={4}>
        {summary.feeStructures.map((fee) => (
          <TR key={fee.id}>
            <TD>
              <span style={{ fontWeight: 600 }}>{fee.description ?? fee.fee_type}</span>
              <div style={{ color: "#6b7280", fontSize: 12 }}>
                {fee.programme_code ?? fee.programme_title ?? "—"}
              </div>
            </TD>
            <TD muted>{fee.student_category}</TD>
            <TD muted>
              {fee.academic_year_name ?? "—"}{fee.term_name ? ` · ${fee.term_name}` : ""}
            </TD>
            <TD>
              <span style={{ fontWeight: 600 }}>
                {fee.currency} {fee.amount.toLocaleString()}
              </span>
            </TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

export function FeesPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prefillId = params.get("student_id");
  const prefillName = params.get("student_name");

  const [activeTab, setActiveTab] = useState<"overview" | "student">(
    prefillId ? "student" : "overview",
  );
  const [search, setSearch] = useState(prefillName ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    prefillId,
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    prefillId && prefillName
      ? ({ id: prefillId, first_name: prefillName, last_name: "" } as Student)
      : null,
  );

  const overviewQ = useQuery({
    queryKey: ["feeOverview"],
    queryFn: getFeeOverview,
  });

  const defaultersQ = useQuery({
    queryKey: ["feeDefaulters"],
    queryFn: getFeeDefaulters,
  });

  const { data: students } = useQuery({
    queryKey: ["students-search", search],
    queryFn: () => listStudents({ search: search || undefined }),
    enabled: search.length >= 2 && !selectedStudentId,
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

  function selectStudent(student: Student) {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    setSearch(`${student.first_name} ${student.last_name}`);
  }

  return (
    <div>
      <PageHeader
        title="Finance"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn onClick={() => navigate("/finance/import")}>
              ⬆ Import CSV
            </SecondaryBtn>
            {activeTab === "student" && selectedStudentId && (
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

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["overview", "student"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
              background: activeTab === tab ? "#2563eb" : "#fff",
              color: activeTab === tab ? "#fff" : "#374151",
            }}
          >
            {tab === "overview" ? "📊 Overview" : "🎓 Student Fees"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div>
          {overviewQ.isLoading && <Spinner />}
          {overviewQ.data && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 16,
                  marginBottom: 28,
                }}
              >
                <StatCard label="Total Students" value={overviewQ.data.totalStudents.toLocaleString()} accent="#2563eb" />
                <StatCard label="Total Expected" value={`UGX ${overviewQ.data.totalExpected.toLocaleString()}`} accent="#7c3aed" />
                <StatCard label="Total Collected" value={`UGX ${overviewQ.data.totalCollected.toLocaleString()}`} accent="#16a34a" />
                <StatCard
                  label="Collection Rate"
                  value={`${overviewQ.data.collectionRate}%`}
                  accent={overviewQ.data.collectionRate >= 75 ? "#16a34a" : "#dc2626"}
                />
                <StatCard label="Fully Paid" value={overviewQ.data.fullyPaid.toLocaleString()} accent="#16a34a" />
                <StatCard
                  label="Defaulters"
                  value={overviewQ.data.defaulters.toLocaleString()}
                  accent={overviewQ.data.defaulters > 0 ? "#dc2626" : "#16a34a"}
                />
              </div>

              <SectionLabel>Fee Defaulters</SectionLabel>
              {defaultersQ.isLoading && <Spinner />}
              <DataTable
                headers={["Student", "Admission #", "Programme", "Paid", "Balance"]}
                isLoading={defaultersQ.isLoading}
                isEmpty={!defaultersQ.isLoading && (defaultersQ.data ?? []).length === 0}
                emptyIcon="🎉"
                emptyTitle="No defaulters"
                emptyDescription="All students are fully paid."
                colCount={5}
              >
                {(defaultersQ.data ?? []).map((d: Defaulter) => (
                  <TR key={d.id}>
                    <TD>{d.first_name} {d.last_name}</TD>
                    <TD muted>{d.admission_number ?? "—"}</TD>
                    <TD muted>{d.programme ?? "—"}</TD>
                    <TD muted>{d.total_paid?.toLocaleString() ?? "—"}</TD>
                    <TD>
                      <span style={{ color: "#dc2626", fontWeight: 600 }}>
                        {d.balance?.toLocaleString() ?? "—"}
                      </span>
                    </TD>
                  </TR>
                ))}
              </DataTable>
            </>
          )}
        </div>
      )}

      {/* Student Fees tab */}
      {activeTab === "student" && (
        <div>
      {/* Student search */}
      <Card padding="20px 24px" style={{ marginBottom: 24, overflow: "visible" }}>
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
              if (e.target.value === "") {
                setSelectedStudentId(null);
                setSelectedStudent(null);
              }
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

          {summary && (
            <>
              <FeeSummaryCards summary={summary} />
              <FeeStructureBreakdown summary={summary} />
            </>
          )}

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
            headers={["Date", "Amount", "Currency", "Method", "Reference", "Source"]}
            isLoading={txnLoading}
            isEmpty={!txnLoading && transactions.length === 0}
            emptyIcon="💳"
            emptyTitle="No payments recorded"
            emptyDescription='Click "+ Record Payment" to add the first.'
            colCount={6}
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
                <TD muted>{txn.payment_method ?? "—"}</TD>
                <TD muted>{txn.reference ?? "—"}</TD>
                <TD muted>{txn.source}</TD>
              </TR>
            ))}
          </DataTable>

          {transactions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <SecondaryBtn
                onClick={() =>
                  navigate(
                    `/finance/receipt?student_id=${selectedStudentId}`,
                  )
                }
              >
                🧾 Print Receipt
              </SecondaryBtn>
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}
