import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getTermAnalytics } from "./analytics.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  ErrorBanner,
  SectionLabel,
  StatCard,
  Spinner,
  inputCss,
} from "../../lib/ui";

type BadgeColor = "gray" | "blue" | "green" | "red" | "yellow";
const STATE_BADGE: Record<string, BadgeColor> = {
  draft: "gray",
  submitted: "blue",
  reviewing: "yellow",
  approved: "green",
  rejected: "red",
  scheduled: "gray",
  active: "blue",
  completed: "green",
  cancelled: "red",
};

export function AnalyticsPage() {
  ensureGlobalCss();
  const [params, setParams] = useSearchParams();
  const academic_year = params.get("academic_year") ?? "";
  const term = params.get("term") ?? "";

  function set(key: string, value: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (value) {
        n.set(key, value);
      } else {
        n.delete(key);
      }
      return n;
    });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "analytics",
      "term",
      { academic_year: academic_year || undefined, term: term || undefined },
    ],
    queryFn: () =>
      getTermAnalytics({
        academic_year: academic_year || undefined,
        term: term || undefined,
      }),
  });

  return (
    <div>
      <PageHeader title="Term Analytics" />

      {error && <ErrorBanner message="Failed to load analytics." />}

      <FilterBar>
        <input
          style={{ ...inputCss, width: 160 }}
          placeholder="Academic Year (e.g. 2024)"
          value={academic_year}
          onChange={(e) => set("academic_year", e.target.value)}
        />
        <input
          style={{ ...inputCss, width: 130 }}
          placeholder="Term (e.g. 1)"
          value={term}
          onChange={(e) => set("term", e.target.value)}
        />
      </FilterBar>

      {isLoading && <Spinner />}

      {data && (
        <>
          {/* KPI row */}
          <div
            style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}
          >
            <StatCard
              label="Active Students"
              value={data.students.total_active}
              accent="#6366f1"
            />
            <StatCard
              label="Term Registrations"
              value={data.term_registrations.total}
              accent="#0ea5e9"
            />
            <StatCard
              label="Admission Applications"
              value={data.admissions_by_state.reduce(
                (s, r) => s + Number(r.count),
                0
              )}
              accent="#f59e0b"
            />
            <StatCard
              label="Mark Submissions"
              value={data.marks_by_state.reduce(
                (s, r) => s + Number(r.count),
                0
              )}
              accent="#10b981"
            />
          </div>

          {/* Two-column breakdown tables */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 20,
              marginBottom: 28,
            }}
          >
            {/* Admissions by state */}
            <Card padding="16px 20px">
              <SectionLabel>Admissions by State</SectionLabel>
              <DataTable
                headers={["State", "Count"]}
                isLoading={false}
                isEmpty={data.admissions_by_state.length === 0}
                emptyIcon="📋"
                emptyTitle="No data"
                colCount={2}
              >
                {data.admissions_by_state.map((r) => (
                  <TR key={r.state}>
                    <TD>
                      <Badge
                        label={r.state}
                        color={STATE_BADGE[r.state] ?? "gray"}
                      />
                    </TD>
                    <TD>{r.count}</TD>
                  </TR>
                ))}
              </DataTable>
            </Card>

            {/* Marks by state */}
            <Card padding="16px 20px">
              <SectionLabel>Mark Submissions by State</SectionLabel>
              <DataTable
                headers={["State", "Count"]}
                isLoading={false}
                isEmpty={data.marks_by_state.length === 0}
                emptyIcon="📝"
                emptyTitle="No data"
                colCount={2}
              >
                {data.marks_by_state.map((r) => (
                  <TR key={r.state}>
                    <TD>
                      <Badge
                        label={r.state}
                        color={STATE_BADGE[r.state] ?? "gray"}
                      />
                    </TD>
                    <TD>{r.count}</TD>
                  </TR>
                ))}
              </DataTable>
            </Card>

            {/* Industrial training by status */}
            <Card padding="16px 20px">
              <SectionLabel>Industrial Training by Status</SectionLabel>
              <DataTable
                headers={["Status", "Count"]}
                isLoading={false}
                isEmpty={data.industrial_training_by_status.length === 0}
                emptyIcon="🏗️"
                emptyTitle="No data"
                colCount={2}
              >
                {data.industrial_training_by_status.map((r) => (
                  <TR key={r.status}>
                    <TD>
                      <Badge
                        label={r.status}
                        color={STATE_BADGE[r.status] ?? "gray"}
                      />
                    </TD>
                    <TD>{r.count}</TD>
                  </TR>
                ))}
              </DataTable>
            </Card>

            {/* Field placements by status */}
            <Card padding="16px 20px">
              <SectionLabel>Field Placements by Status</SectionLabel>
              <DataTable
                headers={["Status", "Count"]}
                isLoading={false}
                isEmpty={data.field_placements_by_status.length === 0}
                emptyIcon="📍"
                emptyTitle="No data"
                colCount={2}
              >
                {data.field_placements_by_status.map((r) => (
                  <TR key={r.status}>
                    <TD>
                      <Badge
                        label={r.status}
                        color={STATE_BADGE[r.status] ?? "gray"}
                      />
                    </TD>
                    <TD>{r.count}</TD>
                  </TR>
                ))}
              </DataTable>
            </Card>
          </div>

          {/* Students by programme */}
          <Card padding="16px 20px" style={{ marginBottom: 20 }}>
            <SectionLabel>Students by Programme (Top 10)</SectionLabel>
            <DataTable
              headers={["Code", "Programme", "Students"]}
              isLoading={false}
              isEmpty={data.students_by_programme.length === 0}
              emptyIcon="🎓"
              emptyTitle="No data"
              colCount={3}
            >
              {data.students_by_programme.map((r) => (
                <TR key={r.code}>
                  <TD>
                    <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                      {r.code}
                    </span>
                  </TD>
                  <TD>{r.title}</TD>
                  <TD>{r.student_count}</TD>
                </TR>
              ))}
            </DataTable>
          </Card>
        </>
      )}
    </div>
  );
}
