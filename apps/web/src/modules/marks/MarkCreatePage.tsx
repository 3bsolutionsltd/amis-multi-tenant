import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createSubmission } from "./marks.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listCourses } from "../courses/courses.api";
import { listAcademicYears, listTerms } from "../academic-calendar/academic-calendar.api";
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
const ASSESSMENT_TYPES = [
  { value: "midterm", label: "Midterm" },
  { value: "end_of_term", label: "End of Term" },
  { value: "coursework", label: "Coursework" },
  { value: "practical", label: "Practical" },
];

export function MarkCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const programmesQ = useQuery({
    queryKey: ["programmes"],
    queryFn: listProgrammes,
    staleTime: 60_000,
  });
  const programmes = programmesQ.data ?? [];

  const { data: academicYears } = useQuery({
    queryKey: ["academic-years"],
    queryFn: listAcademicYears,
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    course_id: "",
    programme: "",
    intake: "",
    term: "",
    assessment_type: "end_of_term",
    weight: "",
  });

  // Resolve programme UUID for course filtering
  const selectedProgramme = programmes.find(
    (p) => (p.code ?? p.name) === form.programme,
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
                <option key={p.id} value={p.code ?? p.name}>
                  {p.code ? `${p.code} – ${p.name}` : p.name}
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
              onChange={(e) => set("assessment_type", e.target.value)}
            >
              {ASSESSMENT_TYPES.map((t) => (
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
