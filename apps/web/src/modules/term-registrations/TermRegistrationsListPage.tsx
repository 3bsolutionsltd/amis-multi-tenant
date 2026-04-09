import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listTermRegistrations } from "./term-registrations.api";
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

const TERMS = ["Term 1", "Term 2", "Term 3"];
const TREG_STATES = [
  "REGISTRATION_STARTED",
  "DOCUMENTS_VERIFIED",
  "FEES_VERIFIED",
  "GUILD_FEES_VERIFIED",
  "DEAN_ENDORSED",
  "HALL_ALLOCATED",
  "CATERING_VERIFIED",
  "MEDICAL_CHECKED",
  "LIBRARY_CARD_ISSUED",
  "ONLINE_REGISTERED",
  "EXAM_ENROLLED",
  "CLEARANCE_ISSUED",
];

type BadgeColor =
  | "gray"
  | "blue"
  | "yellow"
  | "purple"
  | "green"
  | "cyan"
  | "indigo"
  | "pink";
const STATE_BADGE: Record<string, BadgeColor> = {
  REGISTRATION_STARTED: "gray",
  DOCUMENTS_VERIFIED: "blue",
  FEES_VERIFIED: "cyan",
  GUILD_FEES_VERIFIED: "purple",
  DEAN_ENDORSED: "green",
  HALL_ALLOCATED: "yellow",
  CATERING_VERIFIED: "green",
  MEDICAL_CHECKED: "green",
  LIBRARY_CARD_ISSUED: "cyan",
  ONLINE_REGISTERED: "indigo",
  EXAM_ENROLLED: "indigo",
  CLEARANCE_ISSUED: "green",
};

export function TermRegistrationsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");
  const [currentState, setCurrentState] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["term-registrations", { academicYear, term, currentState }],
    queryFn: () =>
      listTermRegistrations({
        academic_year: academicYear || undefined,
        term: term || undefined,
        current_state: currentState || undefined,
      }),
  });

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Term Registrations"
        action={
          <PrimaryBtn onClick={() => navigate("/term-registrations/new")}>
            + New Registration
          </PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load registrations." />}

      <FilterBar>
        <input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="Academic year (e.g. 2026/2027)"
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 220,
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
          {TERMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={currentState}
          onChange={(e) => setCurrentState(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All states</option>
          {TREG_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={[
          "Student",
          "Adm. No.",
          "Programme",
          "Year / Term",
          "State",
          "Created",
        ]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="📅"
        emptyTitle="No registrations found"
        emptyDescription='Adjust filters or click "+ New Registration" to add one.'
        colCount={6}
      >
        {data?.map((reg) => (
          <TR
            key={reg.id}
            onClick={() => navigate(`/term-registrations/${reg.id}`)}
          >
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {reg.first_name} {reg.last_name}
              </span>
            </TD>
            <TD muted>{reg.admission_number ?? "—"}</TD>
            <TD muted>{reg.student_programme ?? "—"}</TD>
            <TD muted>
              {reg.academic_year} / {reg.term}
            </TD>
            <TD>
              <Badge
                label={reg.current_state ?? "—"}
                color={STATE_BADGE[reg.current_state ?? ""] ?? "gray"}
              />
            </TD>
            <TD muted>{new Date(reg.created_at).toLocaleDateString()}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}
