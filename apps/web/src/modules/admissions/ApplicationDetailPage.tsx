import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApplication,
  getWorkflowDef,
  fireTransition,
} from "./admissions.api";
import { useConfig } from "../../app/ConfigProvider";

const STATE_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#2563eb",
  UNDER_REVIEW: "#d97706",
  COMMITTEE_REVIEW: "#7c3aed",
  APPROVED_GOVT: "#16a34a",
  APPROVED_PRIVATE: "#16a34a",
  REJECTED: "#dc2626",
  ENROLLED: "#0891b2",
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

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";
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

  if (appLoading) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (!app) return <p style={{ color: "#dc2626" }}>Application not found.</p>;

  const currentState = app.current_state;
  const availableActions = wfDef
    ? wfDef.transitions
        .filter((t) => t.from === currentState)
        .map((t) => t.action)
    : [];

  return (
    <div style={{ maxWidth: 700 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/admissions")}
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
        <h2 style={{ margin: 0 }}>
          {app.first_name} {app.last_name}
        </h2>
        <StateBadge state={currentState} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 32px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <Field label="First Name" value={app.first_name} />
        <Field label="Last Name" value={app.last_name} />
        <Field label="Email" value={app.email} />
        <Field label="Phone" value={app.phone} />
        <Field
          label="Date of Birth"
          value={app.dob ? new Date(app.dob).toLocaleDateString() : null}
        />
        <Field label="Gender" value={app.gender} />
        <Field label="Programme" value={app.programme} />
        <Field label="Intake" value={app.intake} />
        <Field label="Sponsorship Type" value={app.sponsorship_type} />
        <Field
          label="Applied"
          value={new Date(app.created_at).toLocaleString()}
        />
      </div>

      {/* Workflow actions */}
      {availableActions.length > 0 && (
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>
            Workflow Actions
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {availableActions.map((action) => (
              <button
                key={action}
                disabled={transitionMut.isPending}
                onClick={() => transitionMut.mutate(action)}
                style={{
                  backgroundColor: primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: transitionMut.isPending ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: transitionMut.isPending ? 0.7 : 1,
                }}
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {transitionError && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
              {transitionError}
            </p>
          )}
        </div>
      )}

      {currentState && availableActions.length === 0 && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          No further actions available for state <strong>{currentState}</strong>
          .
        </p>
      )}
    </div>
  );
}
