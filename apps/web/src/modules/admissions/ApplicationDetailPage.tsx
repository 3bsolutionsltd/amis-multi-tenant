import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApplication,
  getWorkflowDef,
  fireTransition,
} from "./admissions.api";
import { createStudent } from "../students/students.api";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
} from "../../lib/ui";

const STATE_BADGE_COLOR: Record<
  string,
  "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "cyan"
> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "yellow",
  COMMITTEE_REVIEW: "purple",
  APPROVED_GOVT: "green",
  APPROVED_PRIVATE: "green",
  REJECTED: "red",
  ENROLLED: "cyan",
};

function formatExtKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExtensionFields({ ext }: { ext: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(ext).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <Card padding="0 24px" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <SectionLabel>
          Additional Details ({entries.length} fields)
        </SectionLabel>
        <span style={{ fontSize: 18, color: "#6b7280" }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open &&
        entries.map(([k, v]) => (
          <DetailRow key={k} label={formatExtKey(k)}>
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </DetailRow>
        ))}
    </Card>
  );
}

export function ApplicationDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
    enabled: !!id,
  });

  const { data: wfDef } = useQuery({
    queryKey: ["workflowDef", "admissions"],
    queryFn: () => getWorkflowDef("admissions"),
  });

  const transitionMut = useMutation({
    mutationFn: (action: string) =>
      fireTransition("admissions", id!, "admissions", action),
    onSuccess: () => {
      setTransitionError(null);
      qc.invalidateQueries({ queryKey: ["application", id] });
    },
    onError: (err) => {
      setTransitionError(
        err instanceof Error ? err.message : "Transition failed",
      );
    },
  });

  const enrolMut = useMutation({
    mutationFn: () =>
      createStudent({
        first_name: app!.first_name,
        last_name: app!.last_name,
        date_of_birth: app!.dob ?? undefined,
        programme: app!.programme ?? undefined,
        sponsorship_type: app!.sponsorship_type ?? undefined,
        email: app!.email ?? undefined,
        phone: app!.phone ?? undefined,
        extension: app!.extension,
      }),
    onSuccess: (student) => {
      navigate(`/students/${student.id}`);
    },
    onError: (err) => {
      setEnrolError(err instanceof Error ? err.message : "Enrolment failed");
    },
  });

  if (appLoading) return <Spinner />;
  if (!app)
    return (
      <div>
        <PageHeader
          title="Application"
          back={{ label: "Admissions", to: "/admissions" }}
        />
        <ErrorBanner message="Application not found." />
      </div>
    );

  const currentState = app.current_state;
  const availableActions = wfDef
    ? wfDef.transitions
        .filter((t) => t.from === currentState)
        .map((t) => t.action)
    : [];

  return (
    <div>
      <PageHeader
        title={`${app.first_name} ${app.last_name}`}
        back={{ label: "Admissions", to: "/admissions" }}
        action={
          currentState ? (
            <Badge
              label={currentState}
              color={STATE_BADGE_COLOR[currentState] ?? "gray"}
            />
          ) : undefined
        }
      />

      <Card padding="0 24px" style={{ marginBottom: 20 }}>
        <DetailRow label="First name">{app.first_name}</DetailRow>
        <DetailRow label="Last name">{app.last_name}</DetailRow>
        <DetailRow label="Email">{app.email ?? "—"}</DetailRow>
        <DetailRow label="Phone">{app.phone ?? "—"}</DetailRow>
        <DetailRow label="Date of birth">
          {app.dob ? new Date(app.dob).toLocaleDateString() : "—"}
        </DetailRow>
        <DetailRow label="Gender">{app.gender ?? "—"}</DetailRow>
        <DetailRow label="Programme">{app.programme ?? "—"}</DetailRow>
        <DetailRow label="Intake">{app.intake ?? "—"}</DetailRow>
        <DetailRow label="Sponsorship type">
          {app.sponsorship_type ?? "—"}
        </DetailRow>
        <DetailRow label="Applied">
          {new Date(app.created_at).toLocaleString()}
        </DetailRow>
      </Card>

      {app.extension && Object.keys(app.extension).length > 0 && (
        <ExtensionFields ext={app.extension} />
      )}

      {availableActions.length > 0 && (
        <Card padding="20px 24px">
          <SectionLabel>Workflow Actions</SectionLabel>
          {transitionError && <ErrorBanner message={transitionError} />}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {availableActions.map((action) => (
              <PrimaryBtn
                key={action}
                disabled={transitionMut.isPending}
                onClick={() => transitionMut.mutate(action)}
              >
                {action.replace(/_/g, " ")}
              </PrimaryBtn>
            ))}
          </div>
        </Card>
      )}

      {currentState && availableActions.length === 0 && (
        <p style={{ color: "#6b7280", fontSize: 14, margin: "16px 0 0" }}>
          No further actions available for state <strong>{currentState}</strong>
          .
        </p>
      )}

      {(currentState === "ENROLLED" ||
        currentState === "APPROVED_GOVT" ||
        currentState === "APPROVED_PRIVATE") && (
        <Card padding="20px 24px" style={{ marginTop: 16 }}>
          <SectionLabel>Student Record</SectionLabel>
          {enrolError && <ErrorBanner message={enrolError} />}
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px" }}>
            Create a student record pre-filled with this applicant's details.
          </p>
          <PrimaryBtn
            disabled={enrolMut.isPending}
            onClick={() => enrolMut.mutate()}
          >
            {enrolMut.isPending ? "Creating student…" : "🎓 Enrol as Student"}
          </PrimaryBtn>
        </Card>
      )}
    </div>
  );
}
