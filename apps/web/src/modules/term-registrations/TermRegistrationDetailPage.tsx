import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTermRegistration,
  getDocChecks,
  upsertDocCheck,
  getWorkflowDef,
  fireTransition,
} from "./term-registrations.api";
import type { DocCheck } from "./term-registrations.api";
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
import { formatStudentName } from "../../lib/formatStudentName";

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

  const { data: docChecks } = useQuery({
    queryKey: ["term-registration-doc-checks", id],
    queryFn: () => getDocChecks(id!),
    enabled: !!id && !!reg,
  });

  const docCheckMut = useMutation({
    mutationFn: ({
      docName,
      status,
      remarks,
    }: {
      docName: string;
      status: "PENDING" | "ACCEPTED" | "REJECTED" | "WAIVED";
      remarks?: string;
    }) => upsertDocCheck(id!, docName, { status, remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-registration-doc-checks", id] });
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
  const myRole = user?.role ?? null;
  const superRoles = ["admin", "platform_admin"];
  const canReviewDocs = myRole !== null && (superRoles.includes(myRole) || myRole === "registrar");

  const availableActions = wfDef
    ? wfDef.transitions
        .filter(
          (t) =>
            t.from === currentState &&
            (!t.required_role ||
              t.required_role === myRole ||
              superRoles.includes(myRole ?? "")),
        )
        .map((t) => t.action)
    : [];

  // Doc checklist derived state
  const allDocsReady =
    docChecks && docChecks.length > 0 &&
    docChecks.every((d: DocCheck) => d.status === "ACCEPTED" || d.status === "WAIVED");
  const hasPendingOrRejected =
    docChecks && docChecks.some((d: DocCheck) => d.status === "PENDING" || d.status === "REJECTED");
  const docsBlockVerify = availableActions.includes("verify_docs") && hasPendingOrRejected;

  const studentName =
    reg.first_name && reg.last_name
      ? formatStudentName(reg)
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

      {/* Document Checklist (#199) */}
      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <SectionLabel>Document Checklist</SectionLabel>
        {!docChecks ? (
          <Spinner />
        ) : (
          <>
            {allDocsReady && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#166534",
                  marginBottom: 12,
                }}
              >
                All documents accepted or waived — ready for verification.
              </div>
            )}
            {hasPendingOrRejected && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#92400e",
                  marginBottom: 12,
                }}
              >
                Some documents are still pending or rejected. Accept or waive
                all documents before proceeding to document verification.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docChecks.map((doc: DocCheck) => {
                const statusColor: Record<string, string> = {
                  ACCEPTED: "#15803d",
                  REJECTED: "#b91c1c",
                  WAIVED: "#6b7280",
                  PENDING: "#b45309",
                };
                const statusBg: Record<string, string> = {
                  ACCEPTED: "#f0fdf4",
                  REJECTED: "#fef2f2",
                  WAIVED: "#f9fafb",
                  PENDING: "#fffbeb",
                };
                return (
                  <div
                    key={doc.doc_name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: statusBg[doc.status] ?? "#f9fafb",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {doc.doc_name}
                      </span>
                      {doc.remarks && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginLeft: 8,
                          }}
                        >
                          — {doc.remarks}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: statusColor[doc.status] ?? "#374151",
                        marginRight: canReviewDocs ? 12 : 0,
                        minWidth: 60,
                        textAlign: "right",
                      }}
                    >
                      {doc.status}
                    </span>
                    {canReviewDocs && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {doc.status !== "ACCEPTED" && (
                          <SecondaryBtn
                            style={{ fontSize: 11, padding: "2px 8px" }}
                            disabled={docCheckMut.isPending}
                            onClick={() =>
                              docCheckMut.mutate({
                                docName: doc.doc_name,
                                status: "ACCEPTED",
                              })
                            }
                          >
                            Accept
                          </SecondaryBtn>
                        )}
                        {doc.status !== "REJECTED" && (
                          <SecondaryBtn
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              color: "#b91c1c",
                            }}
                            disabled={docCheckMut.isPending}
                            onClick={() =>
                              docCheckMut.mutate({
                                docName: doc.doc_name,
                                status: "REJECTED",
                              })
                            }
                          >
                            Reject
                          </SecondaryBtn>
                        )}
                        {doc.status !== "WAIVED" && (
                          <SecondaryBtn
                            style={{ fontSize: 11, padding: "2px 8px" }}
                            disabled={docCheckMut.isPending}
                            onClick={() =>
                              docCheckMut.mutate({
                                docName: doc.doc_name,
                                status: "WAIVED",
                              })
                            }
                          >
                            Waive
                          </SecondaryBtn>
                        )}
                        {doc.status !== "PENDING" && (
                          <SecondaryBtn
                            style={{ fontSize: 11, padding: "2px 8px" }}
                            disabled={docCheckMut.isPending}
                            onClick={() =>
                              docCheckMut.mutate({
                                docName: doc.doc_name,
                                status: "PENDING",
                              })
                            }
                          >
                            Reset
                          </SecondaryBtn>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Workflow actions */}
      {availableActions.length > 0 && (
        <Card padding="20px 24px">
          <SectionLabel>
            Workflow Actions
            {myRole && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: "#6b7280",
                  marginLeft: 8,
                }}
              >
                (as {myRole})
              </span>
            )}
          </SectionLabel>
          {transitionError && <ErrorBanner message={transitionError} />}
          {docsBlockVerify && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                color: "#991b1b",
                marginBottom: 12,
              }}
            >
              Cannot verify documents: accept or waive all checklist items
              first.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {availableActions.map((action) => (
              <PrimaryBtn
                key={action}
                disabled={
                  transitionMut.isPending ||
                  (action === "verify_docs" && !!docsBlockVerify)
                }
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
