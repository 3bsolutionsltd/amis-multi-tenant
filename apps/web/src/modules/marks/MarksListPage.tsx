import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listSubmissions } from "./marks.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listAcademicYears, listTerms } from "../academic-calendar/academic-calendar.api";
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
  SecondaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const MARK_STATES = [
  "DRAFT",
  "SUBMITTED",
  "HOD_REVIEW",
  "APPROVED",
  "PUBLISHED",
];

const CONSOLIDATED_STATES = new Set(["APPROVED", "PUBLISHED"]);

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
  const viewMode = params.get("view") ?? "all"; // "all" | "consolidated"

  function set(key: string, value: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set(key, value);
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

  const { data: programmesData } = useQuery({
    queryKey: ["programmes-filter"],
    queryFn: () => listProgrammes({ include_inactive: false }),
  });

  const { data: academicYears } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
    staleTime: 60_000,
  });

  const selectedYear = (academicYears ?? []).find((y) => y.name === intake);
  const { data: terms } = useQuery({
    queryKey: ["terms", selectedYear?.id],
    queryFn: () => listTerms({ academic_year_id: selectedYear?.id }),
    staleTime: 60_000,
  });

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

  // In consolidated mode show only APPROVED / PUBLISHED
  const displayData = viewMode === "consolidated"
    ? (data ?? []).filter((s) => CONSOLIDATED_STATES.has(s.current_state ?? ""))
    : (data ?? []);

  const isEmpty = !isLoading && !error && displayData.length === 0;

  return (
    <div>
      <PageHeader
        title="Marks"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryBtn
              onClick={() => set("view", viewMode === "consolidated" ? "all" : "consolidated")}
            >
              {viewMode === "consolidated" ? "All Submissions" : "Consolidated (Registrar)"}
            </SecondaryBtn>
            <PrimaryBtn onClick={() => navigate("/marks/new")}>
              + New Submission
            </PrimaryBtn>
          </div>
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
          {(programmesData ?? []).map((p) => (
            <option key={p.id} value={p.code}>
              {p.code} — {p.title}
            </option>
          ))}
        </select>
        <select
          value={intake}
          onChange={(e) => set("intake", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 180,
          }}
        >
          <option value="">All intakes</option>
          {(academicYears ?? []).map((y) => (
            <option key={y.id} value={y.name}>
              {y.name}{y.is_current ? " (Current)" : ""}
            </option>
          ))}
        </select>
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
          {(terms ?? []).map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}{t.is_current ? " (Current)" : ""}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={viewMode === "consolidated"
          ? ["Course", "Programme", "Intake / Term", "Type", "Assessment Date", "State", "Created"]
          : ["Course", "Programme", "Intake / Term", "Type", "Assessment Date", "State", "Created"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="📊"
        emptyTitle={viewMode === "consolidated" ? "No approved/published submissions" : "No submissions found"}
        emptyDescription={viewMode === "consolidated" ? "Approved and published marks will appear here." : 'Adjust filters or click "+ New Submission" to add one.'}
        colCount={7}
      >
        {displayData.map((sub) => (
          <TR key={sub.id} onClick={() => navigate(`/marks/${sub.id}`)}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {sub.course_id}
              </span>
              {sub.course_title && (
                <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
                  {sub.course_title}
                </span>
              )}
            </TD>
            <TD muted>{sub.programme}</TD>
            <TD muted>
              {sub.intake} / {sub.term}
            </TD>
            <TD muted>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                {sub.assessment_type ?? "—"}
              </span>
            </TD>
            <TD muted>
              {sub.assessment_date
                ? new Date(sub.assessment_date).toLocaleDateString()
                : "—"}
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
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(page + 1)}
      />
    </div>
  );
}
