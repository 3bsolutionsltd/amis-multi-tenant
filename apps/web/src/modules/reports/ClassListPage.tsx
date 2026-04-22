import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClassList, type ClassListParams } from "./reports.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  ErrorBanner,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6];

export function ClassListPage() {
  const [filters, setFilters] = useState<ClassListParams>({});
  const [applied, setApplied] = useState<ClassListParams>({});

  const reportQ = useQuery({
    queryKey: ["class-list", applied],
    queryFn: () => getClassList(applied),
  });

  function apply() {
    setApplied({ ...filters });
  }

  function handlePrint() {
    window.print();
  }

  const data = reportQ.data;

  return (
    <div>
      <PageHeader
        title="Class List Report"
        actions={
          <button
            onClick={handlePrint}
            style={{
              padding: "8px 18px",
              background: C.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🖨 Print
          </button>
        }
      />

      <FilterBar>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Programme</div>
            <input
              style={{ ...inputCss, width: 200 }}
              placeholder="e.g. BSCS"
              value={filters.programme ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, programme: e.target.value || undefined }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Year of Study</div>
            <select
              style={{ ...selectCss, width: 140 }}
              value={filters.year_of_study ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  year_of_study: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Class Section</div>
            <input
              style={{ ...inputCss, width: 140 }}
              placeholder="e.g. A, B"
              value={filters.class_section ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, class_section: e.target.value || undefined }))
              }
            />
          </div>

          <button
            onClick={apply}
            disabled={reportQ.isLoading}
            style={{
              padding: "8px 18px",
              background: C.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: reportQ.isLoading ? "not-allowed" : "pointer",
            }}
          >
            {reportQ.isLoading ? "Loading…" : "Generate"}
          </button>
        </div>
      </FilterBar>

      {reportQ.error && <ErrorBanner message={String(reportQ.error)} />}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: "flex", gap: 16, margin: "16px 0", flexWrap: "wrap" }}>
            {[
              { label: "Total", value: data.summary.total, color: C.blue },
              { label: "Male", value: data.summary.male, color: C.primary },
              { label: "Female", value: data.summary.female, color: C.purple },
              { label: "Other", value: data.summary.other, color: C.gray500 },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#fff",
                  border: `1px solid ${C.gray200}`,
                  borderRadius: 8,
                  padding: "12px 20px",
                  minWidth: 110,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <DataTable
            columns={["#", "Adm. No.", "Name", "Gender", "Programme", "Year", "Section", "Phone"]}
          >
            {data.students.map((s, i) => (
              <TR key={s.id}>
                <TD>{i + 1}</TD>
                <TD>{s.admission_number}</TD>
                <TD>
                  {s.first_name} {s.last_name}
                </TD>
                <TD>
                  {s.gender && (
                    <Badge
                      label={s.gender}
                      color={
                        s.gender === "male"
                          ? C.blue
                          : s.gender === "female"
                            ? C.purple
                            : C.gray400
                      }
                    />
                  )}
                </TD>
                <TD>{s.programme ?? "—"}</TD>
                <TD>{s.year_of_study != null ? `Year ${s.year_of_study}` : "—"}</TD>
                <TD>{s.class_section ?? "—"}</TD>
                <TD>{s.phone ?? "—"}</TD>
              </TR>
            ))}
          </DataTable>

          {data.students.length === 0 && (
            <p style={{ textAlign: "center", color: C.gray400, padding: 32 }}>
              No students found for the selected filters.
            </p>
          )}
        </>
      )}
    </div>
  );
}
