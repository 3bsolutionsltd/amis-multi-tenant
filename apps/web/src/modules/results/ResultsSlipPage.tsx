import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStudentTermResults, type StudentTermResult } from "./results.api";
import { getStudent } from "../students/students.api";
import { apiFetch } from "../../lib/apiFetch";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Spinner,
  SecondaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const print = () => window.print();

interface Term {
  id: string;
  name: string;
}

export function ResultsSlipPage() {
  ensureGlobalCss();
  const [params] = useSearchParams();
  const studentId = params.get("student_id") ?? "";
  const termId = params.get("term_id") ?? "";
  const { appName } = useConfig();

  const studentQ = useQuery({
    queryKey: ["students", studentId],
    queryFn: () => getStudent(studentId),
    enabled: !!studentId,
  });

  const termQ = useQuery({
    queryKey: ["term", termId],
    queryFn: () => apiFetch<Term>(`/terms/${termId}`),
    enabled: !!termId,
  });

  const resultsQ = useQuery({
    queryKey: ["studentTermResults", studentId, termId],
    queryFn: () => getStudentTermResults(studentId, termId),
    enabled: !!studentId && !!termId,
  });

  if (!studentId || !termId)
    return <ErrorBanner message="student_id and term_id query params required" />;
  if (studentQ.isLoading || resultsQ.isLoading) return <Spinner />;

  const student = studentQ.data;
  const result: StudentTermResult | undefined = resultsQ.data;
  const term = termQ.data;

  if (!student) return <ErrorBanner message="Student not found" />;

  const now = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          header, nav, .no-print, [class*="PageHeader"] { display: none !important; }
          body { background: #fff !important; }
          .slip-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Results Slip"
          back={{ label: "Results", to: "/results" }}
          action={
            <SecondaryBtn onClick={print}>🖨 Print / Save PDF</SecondaryBtn>
          }
        />
      </div>

      <div
        className="slip-container"
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
          <p style={{ fontSize: 14, color: "#374151", margin: "4px 0", fontWeight: 600 }}>
            End-of-Term Results Slip
          </p>
          {term && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0" }}>
              {term.name}
            </p>
          )}
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
          {result?.summary && (
            <div>
              <strong>Class Rank:</strong> {result.summary.rank ?? "—"}
            </div>
          )}
        </div>

        {/* Courses table */}
        {result && result.courses.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={th}>Course</th>
                <th style={{ ...th, textAlign: "center" }}>Score</th>
                <th style={{ ...th, textAlign: "center" }}>Grade</th>
                <th style={{ ...th, textAlign: "center" }}>Grade Point</th>
              </tr>
            </thead>
            <tbody>
              {result.courses.map((c) => (
                <tr key={c.course_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={td}>{c.course_id}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {Number(c.score).toFixed(1)}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                    {c.grade ?? "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {c.grade_point != null ? Number(c.grade_point).toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 32,
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            No results found for this student in this term.
          </div>
        )}

        {/* GPA summary */}
        {result?.summary && (
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 8,
              padding: "16px 24px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
                GPA
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
                {Number(result.summary.gpa).toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
                Credits
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
                {result.summary.total_credits}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
                Rank
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
                {result.summary.rank ?? "—"}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          <span>This is a computer-generated results slip.</span>
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
