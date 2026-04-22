import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listSubmissions, putEntries, type Submission } from "./marks.api";
import { listStudents, type Student } from "../students/students.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Spinner,
  EmptyState,
  ErrorBanner,
  SectionLabel,
  inputCss,
  C,
} from "../../lib/ui";

const ASSESSMENT_TYPES = [
  { value: "end_of_term", label: "End of Term" },
  { value: "midterm", label: "Midterm" },
  { value: "coursework", label: "Coursework" },
  { value: "practical", label: "Practical" },
] as const;

export function BulkMarkEntryPage() {
  ensureGlobalCss();
  const [params] = useSearchParams();
  const preSubmissionId = params.get("submission_id");

  const [selectedSubmissionId, setSelectedSubmissionId] = useState(
    preSubmissionId ?? "",
  );
  const [termFilter, setTermFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("");

  // Scores map: student_id → score string
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch submissions based on filters
  const subsQ = useQuery({
    queryKey: [
      "submissions",
      "bulk-entry",
      termFilter,
      courseFilter,
      assessmentFilter,
    ],
    queryFn: () =>
      listSubmissions({
        term: termFilter || undefined,
        course_id: courseFilter || undefined,
      }),
  });

  // Filter further by assessment_type client-side if needed
  const filteredSubs = (subsQ.data ?? []).filter((s: Submission & { assessment_type?: string }) => {
    if (assessmentFilter && s.assessment_type !== assessmentFilter) return false;
    return true;
  });

  // Fetch students for the class list
  const studentsQ = useQuery({
    queryKey: ["students", "bulk-entry"],
    queryFn: () => listStudents({ limit: 100 }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedSubmissionId) throw new Error("No submission selected");
      const entries = Object.entries(scores)
        .filter(([, v]) => v !== "" && !isNaN(Number(v)))
        .map(([student_id, score]) => ({
          student_id,
          score: Number(score),
        }));
      if (entries.length === 0) throw new Error("No valid scores entered");
      return putEntries(selectedSubmissionId, entries);
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: (e: Error) => {
      setSaveError(e.message);
      setSaveSuccess(false);
    },
  });

  const updateScore = useCallback((studentId: string, value: string) => {
    setScores((prev) => ({ ...prev, [studentId]: value }));
    setSaveSuccess(false);
  }, []);

  const students: Student[] = studentsQ.data ?? [];

  return (
    <div>
      <PageHeader title="Bulk Mark Entry" />

      <Card style={{ marginBottom: 16, padding: 20 }}>
        <SectionLabel>Filters</SectionLabel>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            className={inputCss}
            placeholder="Term (e.g. Term 1)"
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            style={{ width: 160 }}
          />
          <input
            className={inputCss}
            placeholder="Course ID"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            style={{ width: 200 }}
          />
          <select
            className={inputCss}
            value={assessmentFilter}
            onChange={(e) => setAssessmentFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All Types</option>
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <SectionLabel>Select Submission</SectionLabel>
        {subsQ.isLoading ? (
          <Spinner />
        ) : filteredSubs.length === 0 ? (
          <EmptyState title="No submissions found. Adjust filters above." />
        ) : (
          <select
            className={inputCss}
            value={selectedSubmissionId}
            onChange={(e) => setSelectedSubmissionId(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            <option value="">— Choose a submission —</option>
            {filteredSubs.map((s: Submission & { assessment_type?: string }) => (
              <option key={s.id} value={s.id}>
                {s.course_id} · {s.term} · {s.assessment_type ?? "end_of_term"} · [{s.current_state}]
              </option>
            ))}
          </select>
        )}
      </Card>

      {selectedSubmissionId && (
        <Card style={{ padding: 20 }}>
          <SectionLabel>Enter Scores</SectionLabel>
          {studentsQ.isLoading ? (
            <Spinner />
          ) : students.length === 0 ? (
            <EmptyState title="No students found." />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1fr 120px",
                  gap: "4px 12px",
                  marginBottom: 16,
                  fontWeight: 600,
                  fontSize: 13,
                  color: C.textSecondary,
                  borderBottom: `1px solid ${C.border}`,
                  paddingBottom: 6,
                }}
              >
                <span>#</span>
                <span>Student</span>
                <span>Admission #</span>
                <span>Score (0-100)</span>
              </div>
              {students.map((stu, idx) => (
                <div
                  key={stu.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 1fr 120px",
                    gap: "4px 12px",
                    padding: "6px 0",
                    borderBottom: `1px solid ${C.border}`,
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: C.textSecondary, fontSize: 12 }}>
                    {idx + 1}
                  </span>
                  <span>
                    {stu.first_name} {stu.last_name}
                  </span>
                  <span style={{ color: C.textSecondary }}>
                    {stu.admission_number ?? "—"}
                  </span>
                  <input
                    className={inputCss}
                    type="number"
                    min={0}
                    max={100}
                    value={scores[stu.id] ?? ""}
                    onChange={(e) => updateScore(stu.id, e.target.value)}
                    style={{ width: 100 }}
                  />
                </div>
              ))}

              {saveError && <ErrorBanner message={saveError} />}
              {saveSuccess && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 14px",
                    background: "#dcfce7",
                    borderRadius: 6,
                    color: "#166534",
                    fontSize: 13,
                  }}
                >
                  Scores saved successfully!
                </div>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                <PrimaryBtn
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                >
                  {saveMut.isPending ? "Saving…" : "💾 Save All Scores"}
                </PrimaryBtn>
                <SecondaryBtn
                  onClick={() => {
                    setScores({});
                    setSaveSuccess(false);
                    setSaveError(null);
                  }}
                >
                  Clear
                </SecondaryBtn>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
