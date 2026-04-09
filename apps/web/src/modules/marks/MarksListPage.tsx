import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listSubmissions } from "./marks.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
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

  const [programme, setProgramme] = useState("");
  const [intake, setIntake] = useState("");
  const [term, setTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["submissions", { programme, intake, term }],
    queryFn: () =>
      listSubmissions({
        programme: programme || undefined,
        intake: intake || undefined,
        term: term || undefined,
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
          onChange={(e) => setProgramme(e.target.value)}
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
          onChange={(e) => setIntake(e.target.value)}
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
          onChange={(e) => setTerm(e.target.value)}
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
    </div>
  );
}
