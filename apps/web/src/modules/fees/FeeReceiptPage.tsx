import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getFeeSummary, getFeeTransactions, type Transaction } from "./fees.api";
import { getStudent } from "../students/students.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Spinner,
  SecondaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const print = () => window.print();

export function FeeReceiptPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const studentId = params.get("student_id") ?? "";
  const txnId = params.get("txn_id"); // optional: focus on a single transaction
  const { appName } = useConfig();

  const studentQ = useQuery({
    queryKey: ["students", studentId],
    queryFn: () => getStudent(studentId),
    enabled: !!studentId,
  });

  const summaryQ = useQuery({
    queryKey: ["feeSummary", studentId],
    queryFn: () => getFeeSummary(studentId),
    enabled: !!studentId,
  });

  const txnQ = useQuery({
    queryKey: ["feeTransactions", studentId],
    queryFn: () => getFeeTransactions(studentId),
    enabled: !!studentId,
  });

  if (!studentId) return <ErrorBanner message="student_id query param required" />;
  if (studentQ.isLoading || txnQ.isLoading) return <Spinner />;

  const student = studentQ.data;
  const summary = summaryQ.data;
  const allTxns: Transaction[] = txnQ.data?.rows ?? [];
  const transactions = txnId ? allTxns.filter((t) => t.id === txnId) : allTxns;

  if (!student) return <ErrorBanner message="Student not found" />;

  const now = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          header, nav, .no-print, [class*="PageHeader"] { display: none !important; }
          body { background: #fff !important; }
          .receipt-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Fee Receipt"
          back={{ label: "Finance", to: "/finance" }}
          action={
            <SecondaryBtn onClick={print}>🖨 Print / Save PDF</SecondaryBtn>
          }
        />
      </div>

      <div
        className="receipt-container"
        style={{
          maxWidth: 700,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "40px 48px",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 4px", fontWeight: 700 }}>
            {appName || "AMIS"}
          </h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Official Fee Receipt
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
            Printed: {now}
          </p>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #111827", margin: "0 0 20px" }} />

        {/* Student info */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 24px",
            marginBottom: 24,
            fontSize: 13,
          }}
        >
          <div>
            <strong>Student:</strong> {student.first_name} {student.last_name}
          </div>
          <div>
            <strong>Admission No:</strong> {student.admission_number ?? "—"}
          </div>
          <div>
            <strong>Programme:</strong> {student.programme ?? "—"}
          </div>
          {summary && (
            <div>
              <strong>Balance:</strong> UGX{" "}
              {Number(summary.balance).toLocaleString()}
            </div>
          )}
        </div>

        {/* Transactions table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f9fafb",
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <th style={th}>Date</th>
              <th style={th}>Reference</th>
              <th style={th}>Source</th>
              <th style={{ ...th, textAlign: "right" }}>Amount (UGX)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={td}>
                  {new Date(t.paid_at).toLocaleDateString("en-GB")}
                </td>
                <td style={td}>{t.reference ?? "—"}</td>
                <td style={td}>{t.source}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                  {Number(t.amount).toLocaleString("en-UG")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111827" }}>
              <td colSpan={3} style={{ ...td, fontWeight: 700 }}>
                Total
              </td>
              <td
                style={{ ...td, textAlign: "right", fontWeight: 700, fontSize: 14 }}
              >
                UGX{" "}
                {transactions
                  .reduce((s, t) => s + Number(t.amount), 0)
                  .toLocaleString("en-UG")}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 32,
          }}
        >
          <span>This is a computer-generated receipt.</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#6b7280",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
};
