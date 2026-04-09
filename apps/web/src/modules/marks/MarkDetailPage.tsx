import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubmission,
  getWorkflowDef,
  fireTransition,
  putEntries,
} from "./marks.api";
import { useConfig } from "../../app/ConfigProvider";

const STATE_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#2563eb",
  HOD_REVIEW: "#d97706",
  APPROVED: "#16a34a",
  PUBLISHED: "#0891b2",
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
    <div style={{ marginBottom: 14 }}>
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

export function MarkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";
  const qc = useQueryClient();

  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [entriesJson, setEntriesJson] = useState("");
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesSuccess, setEntriesSuccess] = useState(false);

  const { data: sub, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => getSubmission(id!),
    enabled: !!id,
  });

  const { data: wfDef } = useQuery({
    queryKey: ["workflowDef", "marks"],
    queryFn: () => getWorkflowDef("marks"),
  });

  const transitionMut = useMutation({
    mutationFn: (action: string) =>
      fireTransition("marks", id!, "marks", action),
    onSuccess: () => {
      setTransitionError(null);
      qc.invalidateQueries({ queryKey: ["submission", id] });
    },
    onError: (err) => {
      setTransitionError(
        err instanceof Error ? err.message : "Transition failed",
      );
    },
  });

  const entriesMut = useMutation({
    mutationFn: (entries: { student_id: string; score: number }[]) =>
      putEntries(id!, entries),
    onSuccess: () => {
      setEntriesError(null);
      setEntriesSuccess(true);
      setEntriesJson("");
      qc.invalidateQueries({ queryKey: ["submission", id] });
    },
    onError: (err) => {
      setEntriesSuccess(false);
      setEntriesError(
        err instanceof Error ? err.message : "Failed to save entries",
      );
    },
  });

  if (isLoading) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (!sub) return <p style={{ color: "#dc2626" }}>Submission not found.</p>;

  const currentState = sub.current_state;
  const isPublished = currentState === "PUBLISHED";

  const availableActions = wfDef
    ? wfDef.transitions
        .filter((t) => t.from === currentState)
        .map((t) => t.action)
    : [];

  function handleSaveEntries() {
    setEntriesError(null);
    setEntriesSuccess(false);
    try {
      const parsed = JSON.parse(entriesJson);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
      entriesMut.mutate(parsed);
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/marks")}
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
          {sub.course_id} — {sub.term}
        </h2>
        <StateBadge state={currentState} />
      </div>

      {/* Metadata */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0 24px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <Field label="Course" value={sub.course_id} />
        <Field label="Programme" value={sub.programme} />
        <Field label="Intake" value={sub.intake} />
        <Field label="Term" value={sub.term} />
        <Field
          label="Created"
          value={new Date(sub.created_at).toLocaleString()}
        />
        <Field
          label="Correction Of"
          value={sub.correction_of_submission_id ?? null}
        />
      </div>

      {/* Entries table */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>
          Mark Entries ({sub.entries.length})
        </h3>
        {sub.entries.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  {["Student ID", "Score", "Last Updated"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sub.entries.map((entry) => (
                  <tr
                    key={entry.student_id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {entry.student_id}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                      {entry.score}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                      {new Date(entry.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "#6b7280", fontSize: 14 }}>No entries yet.</p>
        )}
      </div>

      {/* Add / Update entries */}
      {!isPublished && (
        <div
          style={{
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 20,
            marginBottom: 28,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Add / Update Entries
          </h3>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
            Paste a JSON array:{" "}
            <code>
              [{"{"}"student_id":"…","score":85{"}"}]
            </code>
          </p>
          <textarea
            value={entriesJson}
            onChange={(e) => setEntriesJson(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "monospace",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
            placeholder='[{"student_id":"uuid-here","score":85}]'
          />
          {entriesError && (
            <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 8px" }}>
              {entriesError}
            </p>
          )}
          {entriesSuccess && (
            <p style={{ color: "#16a34a", fontSize: 13, margin: "0 0 8px" }}>
              Entries saved.
            </p>
          )}
          <button
            onClick={handleSaveEntries}
            disabled={entriesMut.isPending || !entriesJson.trim()}
            style={{
              backgroundColor: primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor:
                entriesMut.isPending || !entriesJson.trim()
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
              fontSize: 13,
              opacity: entriesMut.isPending || !entriesJson.trim() ? 0.6 : 1,
            }}
          >
            {entriesMut.isPending ? "Saving…" : "Save Entries"}
          </button>
        </div>
      )}

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
          No further actions for state <strong>{currentState}</strong>.
        </p>
      )}
    </div>
  );
}
