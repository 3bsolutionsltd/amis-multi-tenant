import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createSubmission } from "./marks.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listCourses } from "../courses/courses.api";
import { listAcademicYears, listTerms } from "../academic-calendar/academic-calendar.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const TERMS = ["Term 1", "Term 2", "Term 3"];

/** UVTAB / UTC Kyema TVET standard assessment types */
const DEFAULT_ASSESSMENT_TYPES = [
  { value: "assignment_1", label: "Assignment 1" },
  { value: "assignment_2", label: "Assignment 2" },
  { value: "test_1",       label: "Test 1" },
  { value: "test_2",       label: "Test 2" },
  { value: "practical_1", label: "Practical 1" },
  { value: "practical_2", label: "Practical 2" },
  { value: "end_of_term", label: "End of Term Exam" },
  { value: "midterm",     label: "Midterm" },
  { value: "coursework",  label: "Coursework" },
  { value: "practical",   label: "Practical" },
];

/** Standard TVET weights (%) — auto-filled when a TVET type is selected */
const TVET_WEIGHTS: Record<string, number> = {
  assignment_1: 5,
  assignment_2: 5,
  test_1: 10,
  test_2: 10,
  practical_1: 25,
  practical_2: 25,
  end_of_term: 40,
};

/** Convert snake_case or raw strings to Title Case for display.
 *  e.g. "end_of_term" → "End of Term", "assignmnt" → "Assignmnt" */
function formatAssessmentType(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function MarkCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const { assessmentTypes: configTypes } = useConfig();

  const assessmentTypes = configTypes.length > 0
    ? configTypes.map((t) => ({ value: t, label: formatAssessmentType(t) }))
    : DEFAULT_ASSESSMENT_TYPES;

  const programmesQ = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
    staleTime: 60_000,
  });
  const programmes = programmesQ.data ?? [];

  const { data: academicYears } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    course_id: "",
    programme: "",
    intake: "",
    term: "",
    assessment_type: "end_of_term",
    weight: "",
    assessment_date: "",
  });

  // Resolve programme UUID for course filtering
  const selectedProgramme = programmes.find(
    (p) => (p.code ?? p.title) === form.programme,
  );
  const coursesQ = useQuery({
    queryKey: ["courses", selectedProgramme?.id],
    queryFn: () => listCourses({ programme_id: selectedProgramme?.id, limit: 200 }),
    enabled: !!selectedProgramme?.id,
    staleTime: 60_000,
  });
  const courses = coursesQ.data ?? [];

  const selectedYear = (academicYears ?? []).find((y) => y.name === form.intake);
  const termsQ = useQuery({
    queryKey: ["terms", selectedYear?.id],
    queryFn: () => listTerms({ academic_year_id: selectedYear?.id }),
    enabled: !!selectedYear?.id,
    staleTime: 60_000,
  });
  const termOptions = termsQ.data ?? [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createSubmission({
        ...form,
        weight: form.weight ? Number(form.weight) : undefined,
        assessment_date: form.assessment_date || undefined,
      });
      navigate(`/marks/${result.submission.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create submission",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Mark Submission"
        back={{ label: "Marks", to: "/marks" }}
      />
      <Card padding="24px" style={{ maxWidth: 480 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Field label="Programme" required>
            <select
              required
              style={selectCss}
              value={form.programme}
              onChange={(e) => { set("programme", e.target.value); set("course_id", ""); }}
            >
              <option value="">— Select Programme —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.code ?? p.title}>
                  {p.code ? `${p.code} – ${p.title}` : p.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Course" required>
            {selectedProgramme ? (
              <select
                required
                style={selectCss}
                value={form.course_id}
                onChange={(e) => set("course_id", e.target.value)}
                disabled={coursesQ.isLoading}
              >
                <option value="">{coursesQ.isLoading ? "Loading courses…" : "— Select Course —"}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                style={{ ...selectCss, background: "#f9fafb", color: "#9ca3af", cursor: "not-allowed" }}
                value=""
                disabled
                placeholder="Select a programme first"
                readOnly
              />
            )}
          </Field>

          <Field label="Intake (Academic Year)" required>
            <select
              required
              style={selectCss}
              value={form.intake}
              onChange={(e) => { set("intake", e.target.value); set("term", ""); }}
            >
              <option value="">— Select Academic Year —</option>
              {(academicYears ?? []).map((y) => (
                <option key={y.id} value={y.name}>
                  {y.name}{y.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Term" required>
            <select
              required
              style={selectCss}
              value={form.term}
              onChange={(e) => set("term", e.target.value)}
              disabled={!selectedYear}
            >
              <option value="">{!selectedYear ? "Select intake first" : "— Select Term —"}</option>
              {termOptions.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}{t.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assessment Type" required>
            <select
              required
              style={selectCss}
              value={form.assessment_type}
              onChange={(e) => {
                const type = e.target.value;
                set("assessment_type", type);
                if (TVET_WEIGHTS[type] !== undefined) {
                  set("weight", String(TVET_WEIGHTS[type]));
                }
              }}
            >
              {assessmentTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Weight (%)">
            <input
              type="number"
              min={0}
              max={100}
              style={inputCss}
              value={form.weight}
              placeholder="e.g. 30"
              onChange={(e) => set("weight", e.target.value)}
            />
          </Field>

          <Field label="Assessment Date">
            <input
              type="date"
              style={inputCss}
              value={form.assessment_date}
              onChange={(e) => set("assessment_date", e.target.value)}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create Submission"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
