import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTranscript, type TranscriptTerm } from "./results.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Spinner,
  SecondaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const print = () => window.print();

export function TranscriptPage() {
  ensureGlobalCss();
  const [params] = useSearchParams();
  const studentId = params.get("student_id") ?? "";
  const { appName } = useConfig();

  const transcriptQ = useQuery({
    queryKey: ["transcript", studentId],
    queryFn: () => getTranscript(studentId),
    enabled: !!studentId,
  });

  if (!studentId) return <ErrorBanner message="student_id query param required" />;
  if (transcriptQ.isLoading) return <Spinner />;
  if (transcriptQ.isError) return <ErrorBanner message="Failed to load transcript" />;

  const data = transcriptQ.data;
  if (!data) return <ErrorBanner message="Student not found" />;
  const { student, terms, cumulativeGpa } = data;

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
          .transcript-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Academic Transcript"
          back={{ label: "Results", to: "/results" }}
          action={
            <SecondaryBtn onClick={print}>🖨 Print / Save PDF</SecondaryBtn>
          }
        />
      </div>

      <div
        className="transcript-container"
        style={{
          maxWidth: 760,
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
          <h1 style={{ fontSize: 22, margin: "0 0 4px", fontWeight: 700 }}>
            {appName || "AMIS"}
          </h1>
          <p style={{ fontSize: 15, color: "#374151", margin: "4px 0", fontWeight: 600 }}>
            Official Academic Transcript
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
            marginBottom: 28,
            fontSize: 13,
          }}
        >
          <div><strong>Student:</strong> {student.first_name} {student.last_name}</div>
          <div><strong>Admission No:</strong> {student.admission_number ?? "—"}</div>
          <div><strong>Programme:</strong> {student.programme ?? "—"}</div>
          {student.year_of_study != null && (
            <div><strong>Year of Study:</strong> {student.year_of_study}</div>
          )}
          {student.class_section && (
            <div><strong>Class/Section:</strong> {student.class_section}</div>
          )}
          {cumulativeGpa != null && (
            <div style={{ gridColumn: "span 2" }}>
              <strong style={{ fontSize: 14 }}>Cumulative GPA:</strong>{" "}
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color:
                    cumulativeGpa >= 3.5
                      ? "#16a34a"
                      : cumulativeGpa >= 2.0
                        ? "#2563eb"
                        : "#dc2626",
                }}
              >
                {Number(cumulativeGpa).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {terms.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            No results found for this student.
          </div>
        ) : (
          terms.map((term: TranscriptTerm) => (
            <div key={term.termId} style={{ marginBottom: 32 }}>
              {/* Term heading */}
              <div
                style={{
                  background: "#f3f4f6",
                  borderRadius: "6px 6px 0 0",
                  padding: "8px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {term.termName} — {term.academicYear}
                </span>
                {term.summary && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    GPA:{" "}
                    <strong style={{ color: "#111827" }}>
                      {Number(term.summary.gpa).toFixed(2)}
                    </strong>{" "}
                    &nbsp;|&nbsp; Credits: {term.summary.total_credits}
                    {term.summary.rank != null && (
                      <> &nbsp;|&nbsp; Rank: {term.summary.rank}</>
                    )}
                  </span>
                )}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: "1px solid #e5e7eb",
                  borderTop: "none",
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={th}>Course</th>
                    <th style={{ ...th, textAlign: "center" }}>Score</th>
                    <th style={{ ...th, textAlign: "center" }}>Grade</th>
                    <th style={{ ...th, textAlign: "center" }}>Grade Points</th>
                  </tr>
                </thead>
                <tbody>
                  {term.courses.map((c) => (
                    <tr key={c.course_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={td}>{c.course_id}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {Number(c.score).toFixed(1)}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                        {c.grade ?? "—"}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {c.grade_point != null
                          ? Number(c.grade_point).toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {/* Footer */}
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0 16px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          <span>This is a computer-generated academic transcript.</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "9px 12px",
};
