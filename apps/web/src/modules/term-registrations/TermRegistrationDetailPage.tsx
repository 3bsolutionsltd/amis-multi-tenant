import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTermRegistration,
  getWorkflowDef,
  fireTransition,
} from "./term-registrations.api";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  ErrorBanner,
  SectionLabel,
} from "../../lib/ui";

const STATE_BADGE_COLOR: Record<
  string,
  "gray" | "blue" | "cyan" | "purple" | "pink" | "yellow" | "green" | "indigo"
> = {
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

export function TermRegistrationDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: reg, isLoading } = useQuery({
    queryKey: ["term-registration", id],
    queryFn: () => getTermRegistration(id!),
    enabled: !!id,
  });

  const { data: wfDef } = useQuery({
    queryKey: ["workflowDef", "term_registration"],
    queryFn: () => getWorkflowDef("term_registration"),
  });

  const transitionMut = useMutation({
    mutationFn: (action: string) =>
      fireTransition("term_registration", id!, "term_registration", action),
    onSuccess: () => {
      setTransitionError(null);
      qc.invalidateQueries({ queryKey: ["term-registration", id] });
    },
    onError: (err) => {
      setTransitionError(
        err instanceof Error ? err.message : "Transition failed",
      );
    },
  });

  if (isLoading) return <Spinner />;
  if (!reg)
    return (
      <div>
        <PageHeader
          title="Term Registration"
          back={{ label: "Term Registrations", to: "/term-registrations" }}
        />
        <ErrorBanner message="Term registration not found." />
      </div>
    );

  const currentState = reg.current_state;
  const { user } = useAuth();
  const availableActions = wfDef
    ? wfDef.transitions
        .filter(
          (t) =>
            t.from === currentState &&
            (!t.required_role ||
              t.required_role === user?.role ||
              user?.role === "admin" ||
              user?.role === "platform_admin"),
        )
        .map((t) => t.action)
    : [];

  const studentName =
    reg.first_name && reg.last_name
      ? `${reg.first_name} ${reg.last_name}`
      : "—";

  return (
    <div>
      <PageHeader
        title="Term Registration"
        back={{ label: "Term Registrations", to: "/term-registrations" }}
        action={
          currentState ? (
            <Badge
              label={currentState}
              color={STATE_BADGE_COLOR[currentState] ?? "gray"}
            />
          ) : undefined
        }
      />

      {/* Details */}
      <Card padding="0 24px" style={{ marginBottom: 20 }}>
        <DetailRow label="Student">
          {reg.student_id ? (
            <Link
              to={`/students/${reg.student_id}`}
              style={{
                color: "#2563eb",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {studentName}
            </Link>
          ) : (
            studentName
          )}
        </DetailRow>
        <DetailRow label="Admission no.">
          {reg.admission_number ?? "—"}
        </DetailRow>
        <DetailRow label="Programme">{reg.student_programme ?? "—"}</DetailRow>
        <DetailRow label="Academic year">{reg.academic_year ?? "—"}</DetailRow>
        <DetailRow label="Term">{reg.term ?? "—"}</DetailRow>
        <DetailRow label="State">
          {currentState ? (
            <Badge
              label={currentState}
              color={STATE_BADGE_COLOR[currentState] ?? "gray"}
            />
          ) : (
            "—"
          )}
        </DetailRow>
        <DetailRow label="Registered">
          {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : "—"}
        </DetailRow>
        <DetailRow label="ID">
          <span
            style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}
          >
            {reg.id}
          </span>
        </DetailRow>
      </Card>

      {/* Workflow actions */}
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
    </div>
  );
}
