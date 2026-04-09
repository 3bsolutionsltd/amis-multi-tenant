import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTermRegistration,
  getWorkflowDef,
  fireTransition,
} from "./term-registrations.api";
import { useConfig } from "../../app/ConfigProvider";

const STATE_COLORS: Record<string, string> = {
  REGISTRATION_STARTED: "#6b7280",
  DOCUMENTS_VERIFIED: "#2563eb",
  FEES_VERIFIED: "#0891b2",
  GUILD_FEES_VERIFIED: "#7c3aed",
  DEAN_ENDORSED: "#db2777",
  HALL_ALLOCATED: "#d97706",
  CATERING_VERIFIED: "#16a34a",
  MEDICAL_CHECKED: "#059669",
  LIBRARY_CARD_ISSUED: "#0284c7",
  ONLINE_REGISTERED: "#4f46e5",
  EXAM_ENROLLED: "#dc2626",
  CLEARANCE_ISSUED: "#15803d",
};

function StateBadge({ state }: { state: string | null }) {
  const color = state ? (STATE_COLORS[state] ?? "#6b7280") : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: color,
      }}
    >
      {state ?? "—"}
    </span>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#6b7280",
          marginBottom: 2,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: value ? "#111827" : "#9ca3af" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export function TermRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";
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

  if (isLoading) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (!reg)
    return <p style={{ color: "#dc2626" }}>Term registration not found.</p>;

  const currentState = reg.current_state;
  const availableActions = wfDef
    ? wfDef.transitions
        .filter((t) => t.from === currentState)
        .map((t) => t.action)
    : [];

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/term-registrations")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Term Registration</h2>
        <StateBadge state={currentState} />
      </div>

      {/* Workflow actions */}
      {availableActions.length > 0 && (
        <div
          style={{
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 12,
            }}
          >
            Actions
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableActions.map((action) => (
              <button
                key={action}
                onClick={() => transitionMut.mutate(action)}
                disabled={transitionMut.isPending}
                style={{
                  backgroundColor: primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 16px",
                  cursor: transitionMut.isPending ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: transitionMut.isPending ? 0.7 : 1,
                }}
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {transitionError && (
            <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
              {transitionError}
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 32px",
          }}
        >
          <Field
            label="Student"
            value={
              reg.first_name && reg.last_name
                ? `${reg.first_name} ${reg.last_name}`
                : null
            }
          />
          <Field label="Admission No." value={reg.admission_number} />
          <Field label="Programme" value={reg.student_programme} />
          <Field label="Academic Year" value={reg.academic_year} />
          <Field label="Term" value={reg.term} />
          <Field label="State" value={currentState} />
          <Field
            label="Registered"
            value={
              reg.created_at
                ? new Date(reg.created_at).toLocaleDateString()
                : null
            }
          />
          <Field label="ID" value={reg.id} />
        </div>
      </div>
    </div>
  );
}
