import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubmission,
  getWorkflowDef,
  fireTransition,
  putEntries,
} from "./marks.api";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DataTable,
  TR,
  TD,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  EmptyState,
  SectionLabel,
} from "../../lib/ui";

const STATE_BADGE_COLOR: Record<
  string,
  "gray" | "blue" | "yellow" | "green" | "cyan"
> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  HOD_REVIEW: "yellow",
  APPROVED: "green",
  PUBLISHED: "cyan",
};

export function MarkDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  if (isLoading) return <Spinner />;
  if (!sub)
    return (
      <div>
        <PageHeader title="Submission" back={{ label: "Marks", to: "/marks" }} />
        <ErrorBanner message="Submission not found." />
      </div>
    );

  const currentState = sub.current_state;
  const isPublished = currentState === "PUBLISHED";

  const availableActions = wfDef
    ? wfDef.transitions
        .filter((t) => t.from === currentState)
        .map((t) => t.action)
    : [];

  return (
    <div>
      <PageHeader
        title={`${sub.course_id} — ${sub.term}`}
        back={{ label: "Marks", to: "/marks" }}
        action={
          currentState ? (
            <Badge
              label={currentState}
              color={STATE_BADGE_COLOR[currentState] ?? "gray"}
            />
          ) : undefined
        }
      />

      {/* Metadata */}
      <Card padding="0 24px" style={{ marginBottom: 20 }}>
        <DetailRow label="Course">{sub.course_id}</DetailRow>
        <DetailRow label="Programme">{sub.programme ?? "—"}</DetailRow>
        <DetailRow label="Intake">{sub.intake ?? "—"}</DetailRow>
        <DetailRow label="Term">{sub.term}</DetailRow>
        <DetailRow label="Created">
          {new Date(sub.created_at).toLocaleString()}
        </DetailRow>
        {sub.correction_of_submission_id && (
          <DetailRow label="Correction of">
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              {sub.correction_of_submission_id}
            </span>
          </DetailRow>
        )}
      </Card>

      {/* Entries table */}
      <Card style={{ marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 24px 12px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <SectionLabel>
            Mark Entries ({sub.entries.length})
          </SectionLabel>
        </div>
        <DataTable
          headers={["Student ID", "Score", "Last Updated"]}
          isLoading={false}
          isEmpty={sub.entries.length === 0}
          emptyIcon="📋"
          emptyTitle="No entries yet"
          emptyDescription="Paste a JSON array below to add entries."
          colCount={3}
        >
          {sub.entries.map((entry) => (
            <TR key={entry.student_id}>
              <TD muted>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {entry.student_id}
                </span>
              </TD>
              <TD>
                <span style={{ fontWeight: 600 }}>{entry.score}</span>
              </TD>
              <TD muted>{new Date(entry.updated_at).toLocaleString()}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>

      {/* Add / Update entries */}
      {!isPublished && (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <SectionLabel>Add / Update Entries</SectionLabel>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Paste a JSON array:{" "}
            <code
              style={{
                background: "#f3f4f6",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {`[{"student_id":"…","score":85}]`}
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
              marginBottom: 12,
              resize: "vertical",
            }}
            placeholder='[{"student_id":"uuid-here","score":85}]'
          />
          {entriesError && (
            <ErrorBanner message={entriesError} />
          )}
          {entriesSuccess && (
            <p
              style={{
                color: "#16a34a",
                fontSize: 13,
                margin: "0 0 8px",
                fontWeight: 500,
              }}
            >
              Entries saved successfully.
            </p>
          )}
          <PrimaryBtn
            onClick={handleSaveEntries}
            disabled={entriesMut.isPending || !entriesJson.trim()}
          >
            {entriesMut.isPending ? "Saving…" : "Save Entries"}
          </PrimaryBtn>
        </Card>
      )}

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
          No further actions for state <strong>{currentState}</strong>.
        </p>
      )}
    </div>
  );
}
