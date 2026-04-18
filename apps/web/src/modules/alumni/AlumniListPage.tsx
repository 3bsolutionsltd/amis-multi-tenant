import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listAlumni, exportAlumniCsv } from "./alumni.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Pagination,
} from "../../lib/ui";

export function AlumniListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1");

  function setSearch(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("search", v);
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
    data: alumni,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["alumni", { search, page }],
    queryFn: () => listAlumni({ search: search || undefined, page }),
  });

  const isEmpty = !isLoading && !error && (alumni?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Alumni"
        action={
          <a
            href={exportAlumniCsv()}
            target="_blank"
            rel="noreferrer"
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
              textDecoration: "none",
            }}
          >
            Export CSV
          </a>
        }
      />

      {error && (
        <div style={{ color: "#dc2626", margin: "12px 0" }}>
          Failed to load alumni.
        </div>
      )}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search by name…"
        />
      </FilterBar>

      <DataTable
        headers={["Name", "Programme", "Admission #", "Graduated"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="🎓"
        emptyTitle={
          search ? "No alumni match your search" : "No alumni records yet"
        }
        emptyDescription={
          search
            ? "Try a different search term."
            : "Graduate students to add them here."
        }
        colCount={4}
      >
        {alumni?.map((a) => (
          <TR key={a.id} onClick={() => navigate(`/alumni/${a.id}`)}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {a.first_name} {a.last_name}
              </span>
            </TD>
            <TD muted>{a.programme ?? "—"}</TD>
            <TD muted>{a.admission_number ?? "—"}</TD>
            <TD muted>{a.graduation_date}</TD>
          </TR>
        ))}
      </DataTable>

      <Pagination
        page={page}
        hasMore={(alumni?.length ?? 0) >= 20}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(page + 1)}
      />
    </div>
  );
}
