import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  Card,
  StatCard,
  FilterBar,
  Field,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Spinner,
  EmptyState,
  DataTable,
  TR,
  TD,
  Badge,
} from "../../lib/ui";
import { C, inputCss } from "../../lib/ui";
import {
  getMarksAnalysis,
  type MarksAnalysisParams,
  type CourseAnalysis,
} from "./results.api";

function passRateColor(rate: number): string {
  if (rate >= 80) return C.green;
  if (rate >= 60) return C.yellow;
  return C.red;
}

function passRateBadgeVariant(rate: number): "success" | "warning" | "error" {
  if (rate >= 80) return "success";
  if (rate >= 60) return "warning";
  return "error";
}

function GradeBar({ dist }: { dist: CourseAnalysis["grade_distribution"] }) {
  const total = dist.A + dist.B + dist.C + dist.D + dist.F || 1;
  const grades: { key: keyof typeof dist; color: string }[] = [
    { key: "A", color: C.green },
    { key: "B", color: C.blue },
    { key: "C", color: C.yellow },
    { key: "D", color: C.purple },
    { key: "F", color: C.red },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 5,
          overflow: "hidden",
          flex: 1,
          background: C.gray200,
          minWidth: 80,
        }}
      >
        {grades.map(({ key, color }) => {
          const pct = (dist[key] / total) * 100;
          return pct > 0 ? (
            <div
              key={key}
              title={`${key}: ${dist[key]}`}
              style={{ width: `${pct}%`, background: color }}
            />
          ) : null;
        })}
      </div>
      <span style={{ fontSize: 11, color: C.gray500, whiteSpace: "nowrap" }}>
        {grades.map(({ key }) => `${key}:${dist[key]}`).join(" ")}
      </span>
    </div>
  );
}

export function MarksAnalysisPage() {
  const [filters, setFilters] = useState<MarksAnalysisParams>({});
  const [applied, setApplied] = useState<MarksAnalysisParams>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["marks-analysis", applied],
    queryFn: () => getMarksAnalysis(applied),
  });

  function handleApply() {
    setApplied({ ...filters });
  }

  function handleReset() {
    setFilters({});
    setApplied({});
  }

  function exportCsv() {
    if (!data) return;

    const rows = [
      ["Course", "Students", "Mean Score", "Min", "Max", "Passed", "Failed", "Pass Rate %", "A", "B", "C", "D", "F"],
      ...data.by_course.map((r) => [
        r.course_id,
        r.total_students,
        r.mean_score,
        r.min_score,
        r.max_score,
        r.passed,
        r.failed,
        r.pass_rate,
        r.grade_distribution.A,
        r.grade_distribution.B,
        r.grade_distribution.C,
        r.grade_distribution.D,
        r.grade_distribution.F,
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marks-analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Aggregates
  const totalStudents = data
    ? Math.max(...(data.by_programme.map((p) => p.total_students).concat([0])))
    : 0;
  const overallMean =
    data && data.by_course.length > 0
      ? Math.round(
          (data.by_course.reduce((s, r) => s + r.mean_score, 0) /
            data.by_course.length) *
            10,
        ) / 10
      : 0;
  const overallPassRate =
    data && data.by_course.length > 0
      ? Math.round(
          data.by_course.reduce((s, r) => s + r.pass_rate, 0) /
            data.by_course.length,
        )
      : 0;
  const topCourse =
    data && data.by_course.length > 0
      ? data.by_course.reduce((best, r) =>
          r.mean_score > best.mean_score ? r : best,
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Marks Analysis"
        subtitle="Grade distribution, pass/fail rates and mean scores"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryBtn onClick={() => window.print()}>Print</SecondaryBtn>
            <PrimaryBtn onClick={exportCsv} disabled={!data || data.by_course.length === 0}>
              Export CSV
            </PrimaryBtn>
          </div>
        }
      />

      <FilterBar>
        <Field label="Term ID">
          <input
            style={inputCss}
            placeholder="e.g. term-uuid"
            value={filters.term_id ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, term_id: e.target.value }))}
          />
        </Field>
        <Field label="Programme">
          <input
            style={inputCss}
            placeholder="e.g. BCS"
            value={filters.programme ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, programme: e.target.value }))}
          />
        </Field>
        <Field label="Course ID">
          <input
            style={inputCss}
            placeholder="e.g. CSC101"
            value={filters.course_id ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, course_id: e.target.value }))}
          />
        </Field>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <PrimaryBtn onClick={handleApply}>Generate</PrimaryBtn>
          <SecondaryBtn onClick={handleReset}>Reset</SecondaryBtn>
        </div>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}
      {isLoading && (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spinner />
        </div>
      )}

      {data && (
        <>
          {/* ── Summary Cards ─────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              padding: "16px 24px 0",
            }}
          >
            <StatCard
              label="Courses Analysed"
              value={data.by_course.length}
              accent={C.blue}
            />
            <StatCard
              label="Programmes"
              value={data.by_programme.length}
              accent={C.purple}
            />
            <StatCard
              label="Overall Mean Score"
              value={`${overallMean}%`}
              accent={C.primary}
            />
            <StatCard
              label="Avg Pass Rate"
              value={`${overallPassRate}%`}
              accent={passRateColor(overallPassRate)}
            />
            {topCourse && (
              <StatCard
                label="Best Course"
                value={`${topCourse.course_id} (${topCourse.mean_score}%)`}
                accent={C.green}
              />
            )}
          </div>

          {/* ── By Course ─────────────────────────────────────────── */}
          <Card style={{ margin: "16px 24px" }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 15,
                fontWeight: 700,
                color: C.gray900,
              }}
            >
              Course Performance
            </h3>

            {data.by_course.length === 0 ? (
              <EmptyState
                message="No results found. Process term results first or adjust filters."
              />
            ) : (
              <DataTable
                columns={[
                  "Course",
                  "Students",
                  "Mean",
                  "Min / Max",
                  "Pass Rate",
                  "Grade Distribution",
                ]}
              >
                {data.by_course.map((row) => (
                  <TR key={row.course_id}>
                    <TD>
                      <span style={{ fontWeight: 600 }}>{row.course_id}</span>
                    </TD>
                    <TD>{row.total_students}</TD>
                    <TD>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            row.mean_score >= 70
                              ? C.green
                              : row.mean_score >= 50
                              ? C.gray900
                              : C.red,
                        }}
                      >
                        {row.mean_score}%
                      </span>
                    </TD>
                    <TD>
                      {row.min_score}% / {row.max_score}%
                    </TD>
                    <TD>
                      <Badge
                        label={`${row.pass_rate}%`}
                        variant={passRateBadgeVariant(row.pass_rate)}
                      />
                    </TD>
                    <TD>
                      <GradeBar dist={row.grade_distribution} />
                    </TD>
                  </TR>
                ))}
              </DataTable>
            )}
          </Card>

          {/* ── By Programme ──────────────────────────────────────── */}
          <Card style={{ margin: "0 24px 16px" }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 15,
                fontWeight: 700,
                color: C.gray900,
              }}
            >
              Programme Summary
            </h3>

            {data.by_programme.length === 0 ? (
              <EmptyState message="No programme data." />
            ) : (
              <DataTable
                columns={[
                  "Programme",
                  "Students",
                  "Mean Score",
                  "Passed",
                  "Failed",
                  "Pass Rate",
                  "Mean GPA",
                ]}
              >
                {data.by_programme.map((row, i) => (
                  <TR key={i}>
                    <TD>
                      <span style={{ fontWeight: 600 }}>
                        {row.programme ?? "—"}
                      </span>
                    </TD>
                    <TD>{row.total_students}</TD>
                    <TD>{row.mean_score}%</TD>
                    <TD style={{ color: C.green }}>{row.passed}</TD>
                    <TD style={{ color: C.red }}>{row.failed}</TD>
                    <TD>
                      <Badge
                        label={`${row.pass_rate}%`}
                        variant={passRateBadgeVariant(row.pass_rate)}
                      />
                    </TD>
                    <TD>
                      {row.mean_gpa != null ? (
                        <span style={{ fontWeight: 600 }}>
                          {row.mean_gpa.toFixed(2)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                  </TR>
                ))}
              </DataTable>
            )}
          </Card>

          {/* ── GPA Distribution ──────────────────────────────────── */}
          {data.gpa_distribution.length > 0 && (
            <Card style={{ margin: "0 24px 24px" }}>
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.gray900,
                }}
              >
                Degree Classification Distribution
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {data.gpa_distribution.map((row) => {
                  const isFirst = row.classification.startsWith("First");
                  const isFail = row.classification.startsWith("Fail");
                  const accent = isFirst
                    ? C.green
                    : isFail
                    ? C.red
                    : C.primary;
                  return (
                    <div
                      key={row.classification}
                      style={{
                        flex: "1 1 180px",
                        minWidth: 160,
                        background: C.gray50,
                        border: `1px solid ${C.gray200}`,
                        borderRadius: 8,
                        padding: "14px 18px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: C.gray500,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {row.classification}
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: accent,
                          lineHeight: 1,
                        }}
                      >
                        {row.count}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.gray500,
                          marginTop: 2,
                        }}
                      >
                        Avg GPA {row.avg_gpa.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {!isLoading && !data && !error && (
        <div style={{ padding: 48, textAlign: "center" }}>
          <EmptyState message="Use the filters above and click Generate to load the analysis." />
        </div>
      )}
    </div>
  );
}
