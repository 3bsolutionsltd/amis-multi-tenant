import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarksheet, exportMarksheet, type MarksheetTemplate } from "./marksheet.api";
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
  SecondaryBtn,
  ErrorBanner,
  Spinner,
  C,
} from "../../lib/ui";

const TEMPLATES: { value: MarksheetTemplate; label: string }[] = [
  { value: "master", label: "Master Marksheet" },
  { value: "uvtab", label: "UVTAB Marksheet" },
  { value: "instructor", label: "Instructor Marksheet" },
  { value: "registrar", label: "Registrar Marksheet" },
  { value: "principal", label: "Principal Marksheet" },
];

export function MarksheetPage() {
  ensureGlobalCss();
  const { marksheetDefaultTemplate } = useConfig();

  const [filters, setFilters] = useState({
    programme: "",
    course_id: "",
    intake: "",
    term: "",
  });
  const [applied, setApplied] = useState<typeof filters | null>(null);
  const [template, setTemplate] = useState<MarksheetTemplate>(
    (marksheetDefaultTemplate as MarksheetTemplate) || "uvtab",
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
    staleTime: 60_000,
  });
  const selectedProgramme = programmes.find((p) => (p.code ?? p.title) === filters.programme);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", selectedProgramme?.id],
    queryFn: () => listCourses({ programme_id: selectedProgramme?.id, limit: 200 }),
    enabled: !!selectedProgramme,
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
    staleTime: 60_000,
  });
  const selectedYear = academicYears.find((y) => y.name === filters.intake);

  const { data: terms = [] } = useQuery({
    queryKey: ["terms", selectedYear?.id],
    queryFn: () => listTerms({ academic_year_id: selectedYear?.id }),
    enabled: !!selectedYear,
    staleTime: 60_000,
  });

  const canApply = !!filters.course_id && !!filters.intake && !!filters.term;

  const { data: sheet, isLoading, isError } = useQuery({
    queryKey: ["marksheet", applied],
    queryFn: () =>
      getMarksheet({
        course_id: applied!.course_id,
        programme: applied!.programme || undefined,
        intake: applied!.intake,
        term: applied!.term,
      }),
    enabled: !!applied,
  });

  function apply() {
    setApplied({ ...filters });
  }

  async function handleExport() {
    if (!applied) return;
    setExportError(null);
    setExporting(true);
    try {
      await exportMarksheet({
        course_id: applied.course_id,
        programme: applied.programme || undefined,
        intake: applied.intake,
        term: applied.term,
        template,
      });
    } catch {
      setExportError("Failed to export marksheet.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Marksheet"
        description="Students vs. assessment scores for a course, with computed totals and grades"
      />

      <Card padding="16px 20px" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Field label="Programme">
            <select
              style={selectCss}
              value={filters.programme}
              onChange={(e) =>
                setFilters({ ...filters, programme: e.target.value, course_id: "" })
              }
            >
              <option value="">— Select programme —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.code ?? p.title}>
                  {p.code ? `${p.code} — ${p.title}` : p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course *">
            <select
              style={selectCss}
              value={filters.course_id}
              onChange={(e) => setFilters({ ...filters, course_id: e.target.value })}
              disabled={!selectedProgramme}
            >
              <option value="">{!selectedProgramme ? "Select programme first" : "— Select course —"}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>{c.code} — {c.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Intake *">
            <select
              style={selectCss}
              value={filters.intake}
              onChange={(e) => setFilters({ ...filters, intake: e.target.value, term: "" })}
            >
              <option value="">— Select intake —</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.name}>{y.name}{y.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Term *">
            <select
              style={selectCss}
              value={filters.term}
              onChange={(e) => setFilters({ ...filters, term: e.target.value })}
              disabled={!selectedYear}
            >
              <option value="">{!selectedYear ? "Select intake first" : "— Select term —"}</option>
              {terms.map((t) => (
                <option key={t.id} value={t.name}>{t.name}{t.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Template">
            <select
              style={selectCss}
              value={template}
              onChange={(e) => setTemplate(e.target.value as MarksheetTemplate)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryBtn onClick={apply} disabled={!canApply}>Load Marksheet</PrimaryBtn>
          {sheet && (
            <SecondaryBtn onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting…" : "⬇ Export CSV"}
            </SecondaryBtn>
          )}
        </div>
        {exportError && <ErrorBanner message={exportError} />}
      </Card>

      {!applied ? (
        <Card padding="24px">
          <p style={{ fontSize: 14, color: C.gray500, margin: 0 }}>
            Select a Course, Intake and Term, then click Load Marksheet.
          </p>
        </Card>
      ) : isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorBanner message="Failed to load marksheet." />
      ) : sheet ? (
        <Card padding="0" style={{ overflowX: "auto" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.gray100}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.gray900 }}>
              {sheet.course.code}{sheet.course.title ? ` — ${sheet.course.title}` : ""}
            </div>
            <div style={{ fontSize: 12, color: C.gray500 }}>
              {sheet.programme ?? "—"} · {sheet.intake} · {sheet.term}
            </div>
          </div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50 }}>
                <th style={thStyle}>S/N</th>
                <th style={thStyle}>Reg. No.</th>
                <th style={thStyle}>Student</th>
                {template !== "principal" &&
                  sheet.assessments.map((a) => (
                    <th key={a.submission_id} style={thStyle}>
                      {a.assessment_type}
                      {a.weight != null ? ` (${a.weight}%)` : ""}
                    </th>
                  ))}
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Grade</th>
                {template !== "registrar" && template !== "principal" && (
                  <th style={thStyle}>Signature</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sheet.students.length === 0 ? (
                <tr>
                  <td colSpan={20} style={{ padding: 24, textAlign: "center", color: C.gray400 }}>
                    No students found for this selection.
                  </td>
                </tr>
              ) : (
                sheet.students.map((s, i) => (
                  <tr key={s.student_id}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{s.admission_number ?? "—"}</td>
                    <td style={tdStyle}>{s.last_name}, {s.first_name}</td>
                    {template !== "principal" &&
                      sheet.assessments.map((a) => (
                        <td key={a.submission_id} style={tdStyle}>
                          {s.scores[a.submission_id] ?? "—"}
                        </td>
                      ))}
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{s.total ?? "—"}</td>
                    <td style={tdStyle}>{s.grade ?? "—"}</td>
                    {template !== "registrar" && template !== "principal" && (
                      <td style={tdStyle} />
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: C.gray500,
  borderBottom: `1px solid ${C.gray200}`,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: `1px solid ${C.gray100}`,
  whiteSpace: "nowrap",
};
