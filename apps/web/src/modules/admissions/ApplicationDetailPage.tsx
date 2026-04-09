import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApplication,
  getWorkflowDef,
  fireTransition,
} from "./admissions.api";
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

export function ApplicationDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [transitionError, setTransitionError] = useState<string | null>(null);

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

      {availableActions.length > 0 && (
        <Card padding="20px 24px">
          <SectionLabel>Workflow Actions</SectionLabel>
          {transitionError && (
            <ErrorBanner message={transitionError} />
          )}
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
          No further actions available for state{" "}
          <strong>{currentState}</strong>.
        </p>
      )}
    </div>
  );
}


