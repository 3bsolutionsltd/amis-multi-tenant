import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listSubmissions } from "./marks.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  Pagination,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];
const MARK_STATES = [
  "DRAFT",
  "SUBMITTED",
  "HOD_REVIEW",
  "APPROVED",
  "PUBLISHED",
];

type BadgeColor = "gray" | "blue" | "yellow" | "green" | "cyan";
const STATE_BADGE: Record<string, BadgeColor> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  HOD_REVIEW: "yellow",
  APPROVED: "green",
  PUBLISHED: "cyan",
};

export function MarksListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const programme = params.get("programme") ?? "";
  const intake = params.get("intake") ?? "";
  const term = params.get("term") ?? "";
  const page = Number(params.get("page") ?? "1");

  function set(key: string, value: string) {
    setParams((p) => { const n = new URLSearchParams(p); n.set(key, value); n.set("page", "1"); return n; });
  }
  function setPage(v: number) {
    setParams((p) => { const n = new URLSearchParams(p); n.set("page", String(v)); return n; });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["submissions", { programme, intake, term, page }],
    queryFn: () =>
      listSubmissions({
        programme: programme || undefined,
        intake: intake || undefined,
        term: term || undefined,
        page,
      }),
  });

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Marks"
        action={
          <PrimaryBtn onClick={() => navigate("/marks/new")}>
            + New Submission
          </PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load submissions." />}

      <FilterBar>
        <select
          value={programme}
          onChange={(e) => set("programme", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All Programmes</option>
          {PROGRAMMES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          placeholder="Intake (e.g. 2026/2027)"
          value={intake}
          onChange={(e) => set("intake", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 180,
          }}
        />
        <select
          value={term}
          onChange={(e) => set("term", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All terms</option>
          <option value="Term 1">Term 1</option>
          <option value="Term 2">Term 2</option>
          <option value="Term 3">Term 3</option>
        </select>
      </FilterBar>

      <DataTable
        headers={["Course", "Programme", "Intake / Term", "State", "Created"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="📊"
        emptyTitle="No submissions found"
        emptyDescription='Adjust filters or click "+ New Submission" to add one.'
        colCount={5}
      >
        {data?.map((sub) => (
          <TR key={sub.id} onClick={() => navigate(`/marks/${sub.id}`)}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {sub.course_id}
              </span>
            </TD>
            <TD muted>{sub.programme}</TD>
            <TD muted>
              {sub.intake} / {sub.term}
            </TD>
            <TD>
              <Badge
                label={sub.current_state ?? "—"}
                color={STATE_BADGE[sub.current_state ?? ""] ?? "gray"}
              />
            </TD>
            <TD muted>{new Date(sub.created_at).toLocaleDateString()}</TD>
          </TR>
        ))}
      </DataTable>

      <Pagination
        page={page}
        hasMore={(data?.length ?? 0) >= 20}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
