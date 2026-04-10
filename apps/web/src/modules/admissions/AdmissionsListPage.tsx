import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listApplications } from "./admissions.api";
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
const ADMISSION_STATES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "COMMITTEE_REVIEW",
  "APPROVED_GOVT",
  "APPROVED_PRIVATE",
  "REJECTED",
  "ENROLLED",
];

type BadgeColor =
  | "gray"
  | "blue"
  | "yellow"
  | "purple"
  | "green"
  | "red"
  | "cyan";
const STATE_BADGE: Record<string, BadgeColor> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "yellow",
  COMMITTEE_REVIEW: "purple",
  APPROVED_GOVT: "green",
  APPROVED_PRIVATE: "green",
  REJECTED: "red",
  ENROLLED: "cyan",
};

export function AdmissionsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const [intake, setIntake] = useState("");
  const [programme, setProgramme] = useState("");
  const [currentState, setCurrentState] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", { intake, programme, currentState }],
    queryFn: () =>
      listApplications({
        intake: intake || undefined,
        programme: programme || undefined,
        current_state: currentState || undefined,
      }),
  });

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Admissions"
        action={
          <PrimaryBtn onClick={() => navigate("/admissions/new")}>
            + New Application
          </PrimaryBtn>
        }
      />

      {error && (
        <ErrorBanner message="Failed to load applications. Please try again." />
      )}

      <FilterBar>
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
          <option value="">All States</option>
          {ADMISSION_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={[
          "Name",
          "Programme",
          "Intake",
          "Sponsorship",
          "State",
          "Applied",
        ]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="📋"
        emptyTitle="No applications found"
        emptyDescription='Adjust filters or click "+ New Application" to add one.'
        colCount={6}
      >
        {data?.map((app) => (
          <TR key={app.id} onClick={() => navigate(`/admissions/${app.id}`)}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {app.first_name} {app.last_name}
              </span>
            </TD>
            <TD>{app.programme}</TD>
            <TD muted>{app.intake}</TD>
            <TD muted>{app.sponsorship_type ?? "—"}</TD>
            <TD>
              <Badge
                label={app.current_state ?? "—"}
                color={STATE_BADGE[app.current_state ?? ""] ?? "gray"}
              />
            </TD>
            <TD muted>{new Date(app.created_at).toLocaleDateString()}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}
