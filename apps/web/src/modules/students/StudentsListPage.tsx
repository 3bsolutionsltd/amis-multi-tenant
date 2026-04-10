import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listStudents } from "./students.api";
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
  ErrorBanner,
} from "../../lib/ui";

export function StudentsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1");
  const showInactive = params.get("inactive") === "true";

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
    queryKey: ["students", { search, page, showInactive }],
    queryFn: () =>
      listStudents({
        search: search || undefined,
        page,
        include_inactive: showInactive || undefined,
      }),
  });

  const isEmpty = !isLoading && !error && (students?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Students"
        action={
          <PrimaryBtn onClick={() => navigate("/students/new")}>
            + New Student
          </PrimaryBtn>
        }
      />

      {error && (
        <ErrorBanner message="Failed to load students. Is there a published config for this tenant?" />
      )}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search by name…"
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
        headers={["Student", "Date of Birth", "Status", "Enrolled"]}
        isLoading={isLoading}
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
        colCount={4}
      >
        {students?.map((s) => (
          <TR key={s.id} onClick={() => navigate(`/students/${s.id}`)}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {s.first_name} {s.last_name}
              </span>
            </TD>
            <TD muted>{s.date_of_birth ?? "—"}</TD>
            <TD>
              <Badge
                label={s.is_active ? "Active" : "Inactive"}
                color={s.is_active ? "green" : "gray"}
              />
            </TD>
            <TD muted>{new Date(s.created_at).toLocaleDateString()}</TD>
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
