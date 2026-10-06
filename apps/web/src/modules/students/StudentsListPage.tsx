import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listStudents, exportStudentsCsv } from "./students.api";
import { listAcademicYears, listTerms } from "../academic-calendar/academic-calendar.api";
import { formatStudentName } from "../../lib/formatStudentName";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Badge,
  Pagination,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
} from "../../lib/ui";

export function StudentsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1");
  const showInactive = params.get("inactive") === "true";
  const yearFilter = params.get("year") ? Number(params.get("year")) : undefined;
  const programmeFilter = params.get("programme") ?? "";

  const { data: currentYears } = useQuery({
    queryKey: ["academic-years", "current"],
    queryFn: () => listAcademicYears({ is_current: true }),
  });
  const currentYear = currentYears?.[0];
  const { data: currentTerms } = useQuery({
    queryKey: ["terms", "current-year", currentYear?.id],
    queryFn: () => listTerms({ academic_year_id: currentYear!.id }),
    enabled: !!currentYear,
  });
  const currentTerm = currentTerms?.find((t) => t.is_current);

  function setSearch(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("search", v);
      n.set("page", "1");
      return n;
    });
  }
  function toggleInactive() {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("inactive", showInactive ? "false" : "true");
      n.set("page", "1");
      return n;
    });
  }
  function setYearFilter(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set("year", v); else n.delete("year");
      n.set("page", "1");
      return n;
    });
  }
  function setProgrammeFilter(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set("programme", v); else n.delete("programme");
      n.set("page", "1");
      return n;
    });
  }
  function setPage(v: number) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("page", String(v));
      return n;
    });
  }

  const {
    data: students,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["students", { search, page, showInactive, yearFilter, programmeFilter, currentYear: currentYear?.name, currentTerm: currentTerm?.name }],
    queryFn: () =>
      listStudents({
        search: search || undefined,
        page,
        include_inactive: showInactive || undefined,
        year_of_study: yearFilter,
        programme: programmeFilter || undefined,
        registration_academic_year: currentYear?.name,
        registration_term: currentTerm?.name,
      }),
    enabled: !!currentYear,
  });

  const periodLoading = !currentYears || (!!currentYear && !currentTerms);
  const isEmpty = !isLoading && !periodLoading && !error && (students?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Students"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => exportStudentsCsv()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "#4f46e5",
                color: "white",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              ⬇ Export CSV
            </button>
            <SecondaryBtn onClick={() => navigate("/students/import")}>
              ⬆ Import CSV
            </SecondaryBtn>
            <PrimaryBtn onClick={() => navigate("/students/new")}>
              + New Student
            </PrimaryBtn>
          </div>
        }
      />

      {error && (
        <ErrorBanner message="Failed to load students. Is there a published config for this tenant?" />
      )}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search by name or admission no…"
        />
        <select
          value={yearFilter ?? ""}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{
            padding: "7px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            background: "white",
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          <option value="">All Years</option>
          {[1, 2, 3, 4, 5, 6].map((y) => (
            <option key={y} value={y}>Year {y}</option>
          ))}
        </select>
        <input
          value={programmeFilter}
          onChange={(e) => setProgrammeFilter(e.target.value)}
          placeholder="Filter by programme…"
          style={{
            padding: "7px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            minWidth: 160,
          }}
        />
        <button
          onClick={toggleInactive}
          style={{
            padding: "7px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            background: showInactive ? "#f3f4f6" : "white",
            cursor: "pointer",
            fontWeight: showInactive ? 600 : 400,
          }}
        >
          {showInactive ? "Hide inactive" : "Show inactive"}
        </button>
      </FilterBar>

      <DataTable
        headers={["Adm No.", "Student", "Programme", "Year", "Section", "Funding / Residence", "Active", "Current Term"]}
        isLoading={isLoading || periodLoading}
        isEmpty={isEmpty}
        emptyIcon="👨‍🎓"
        emptyTitle={
          search ? "No students match your search" : "No students yet"
        }
        emptyDescription={
          search
            ? "Try a different search term."
            : 'Click "+ New Student" to add the first one.'
        }
        colCount={8}
      >
        {students?.map((s) => (
          <TR key={s.id} onClick={() => navigate(`/students/${s.id}`)}>
            <TD muted>{s.admission_number ?? "—"}</TD>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {formatStudentName(s)}
              </span>
            </TD>
            <TD muted>{s.programme ?? "—"}</TD>
            <TD muted>{s.year_of_study != null ? `Year ${s.year_of_study}` : "—"}</TD>
            <TD muted>{s.class_section ?? "—"}</TD>
            <TD>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <Badge
                  label={s.sponsorship_type ?? "Funding missing"}
                  color={s.sponsorship_type === "Government" ? "blue" : s.sponsorship_type === "Private" ? "purple" : "gray"}
                />
                <Badge
                  label={s.residence_category === "boarding" ? "Boarding" : s.residence_category === "day" ? "Day" : "Residence missing"}
                  color={s.residence_category === "boarding" ? "green" : s.residence_category === "day" ? "cyan" : "gray"}
                />
              </div>
            </TD>
            <TD>
              <Badge
                label={s.is_active ? "Active" : "Inactive"}
                color={s.is_active ? "green" : "gray"}
              />
            </TD>
            <TD>
              {s.registration_status === "registered" ? (
                <Badge label="Registered" color="green" />
              ) : s.registration_status === "not_registered" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/term-registrations/new?student_id=${s.id}&student_name=${encodeURIComponent(formatStudentName(s))}`);
                  }}
                  style={{ border: "none", background: "none", color: "#b45309", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}
                >
                  Not registered · Register
                </button>
              ) : (
                <span style={{ color: "#6b7280", fontSize: 12 }}>No current term</span>
              )}
            </TD>
          </TR>
        ))}
      </DataTable>

      <Pagination
        page={page}
        hasMore={(students?.length ?? 0) >= 20}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(page + 1)}
      />
    </div>
  );
}
