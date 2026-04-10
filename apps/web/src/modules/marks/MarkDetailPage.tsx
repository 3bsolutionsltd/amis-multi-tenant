import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubmission,
  getWorkflowDef,
  fireTransition,
  putEntries,
} from "./marks.api";
import { listStudents } from "../students/students.api";
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
  SectionLabel,
  inputCss,
  C,
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

type DraftRow = { key: number; student_id: string; student_name: string; score: string };

let _key = 0;
function mkRow(student_id = "", student_name = "", score = ""): DraftRow {
  return { key: ++_key, student_id, student_name, score };
}

// ---------------------------------------------------------------------------
// Inline student search autocomplete for the entry editor
// ---------------------------------------------------------------------------
function StudentSearchInput({
  studentId,
  studentName,
  onChange,
}: {
  studentId: string;
  studentName: string;
  onChange: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState(studentName || studentId);
  const [open, setOpen] = useState(false);

  const { data: suggestions } = useQuery({
    queryKey: ["students-autocomplete", query],
    queryFn: () => listStudents({ search: query }),
    enabled: open && query.length >= 2,
    staleTime: 10_000,
  });

  function pick(id: string, name: string) {
    onChange(id, name);
    setQuery(name);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...inputCss, fontSize: 13 }}
        placeholder="Search student…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("", "");
        }}
      />
      {open && suggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: `1px solid ${C.gray200}`,
            borderRadius: 7,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            zIndex: 200,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => pick(s.id, `${s.first_name} ${s.last_name}`)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: `1px solid ${C.gray100}`,
                fontSize: 13,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = C.gray50;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "#fff";
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {s.first_name} {s.last_name}
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: C.gray400,
                }}
              >
                {s.id}
              </span>
            </div>
          ))}
        </div>
      )}
      {studentId && query !== studentId && (
        <div
          style={{
            fontSize: 10,
            color: C.gray400,
            fontFamily: "monospace",
            paddingTop: 2,
            paddingLeft: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {studentId}
        </div>
      )}
    </div>
  );
}

export function MarkDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([mkRow()]);
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
      setDraftRows([mkRow()]);
      qc.invalidateQueries({ queryKey: ["submission", id] });
    },
    onError: (err) => {
      setEntriesSuccess(false);
      setEntriesError(
        err instanceof Error ? err.message : "Failed to save entries",
      );
    },
  });

  const updateRow = useCallback(
    (key: number, field: "student_id" | "student_name" | "score", value: string) => {
      setDraftRows((rows) =>
        rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  function removeRow(key: number) {
    setDraftRows((rows) => rows.filter((r) => r.key !== key));
  }

  function handleSaveEntries() {
    setEntriesError(null);
    setEntriesSuccess(false);
    const valid = draftRows.filter(
      (r) => r.student_id.trim() && r.score.trim(),
    );
    if (valid.length === 0) {
      setEntriesError("Add at least one row with a Student ID and score.");
      return;
    }
    const invalid = valid.filter((r) => isNaN(Number(r.score)));
    if (invalid.length > 0) {
      setEntriesError(
        `Invalid score on row(s): ${invalid.map((r) => r.student_id).join(", ")}`,
      );
      return;
    }
    entriesMut.mutate(
      valid.map((r) => ({
        student_id: r.student_id.trim(),
        score: Number(r.score),
      })),
    );
  }

  function loadExisting() {
    if (!sub || sub.entries.length === 0) return;
    setDraftRows(
      sub.entries.map((e) =>
        mkRow(
          e.student_id,
          e.first_name || e.last_name
            ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()
            : "",
          String(e.score),
        ),
      ),
    );
  }

  if (isLoading) return <Spinner />;
  if (!sub)
    return (
      <div>
        <PageHeader
          title="Submission"
          back={{ label: "Marks", to: "/marks" }}
        />
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
          <SectionLabel>Mark Entries ({sub.entries.length})</SectionLabel>
        </div>
        <DataTable
          headers={["Student", "Score", "Last Updated"]}
          isLoading={false}
          isEmpty={sub.entries.length === 0}
          emptyIcon="📋"
          emptyTitle="No entries yet"
          emptyDescription="Use the editor below to add student scores."
          colCount={3}
        >
          {sub.entries.map((entry) => (
            <TR key={entry.student_id}>
              <TD>
                <div>
                  {entry.first_name || entry.last_name ? (
                    <span style={{ fontWeight: 500 }}>
                      {entry.first_name} {entry.last_name}
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: C.gray400,
                      display: "block",
                    }}
                  >
                    {entry.student_id}
                  </span>
                </div>
              </TD>
              <TD>
                <span style={{ fontWeight: 600 }}>{entry.score}</span>
              </TD>
              <TD muted>{new Date(entry.updated_at).toLocaleString()}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>

      {/* Row-based entry editor */}
      {!isPublished && (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <SectionLabel>Add / Update Entries</SectionLabel>
            {sub.entries.length > 0 && (
              <button
                onClick={loadExisting}
                style={{
                  fontSize: 12,
                  color: C.primary,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                ↓ Load existing
              </button>
            )}
          </div>

          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 36px",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.gray500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Student
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.gray500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Score
            </span>
            <span />
          </div>

          {draftRows.map((row) => (
            <div
              key={row.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 36px",
                gap: 8,
                marginBottom: 8,
                alignItems: "start",
              }}
            >
              <StudentSearchInput
                studentId={row.student_id}
                studentName={row.student_name}
                onChange={(id, name) => {
                  setDraftRows((rows) =>
                    rows.map((r) =>
                      r.key === row.key
                        ? { ...r, student_id: id, student_name: name }
                        : r,
                    ),
                  );
                }}
              />
              <input
                style={{ ...inputCss, textAlign: "right" }}
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="0–100"
                value={row.score}
                onChange={(e) => updateRow(row.key, "score", e.target.value)}
              />
              <button
                onClick={() => removeRow(row.key)}
                style={{
                  border: "1px solid #fee2e2",
                  borderRadius: 6,
                  background: "#fff",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
                title="Remove row"
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={() => setDraftRows((r) => [...r, mkRow()])}
            style={{
              border: `1px dashed ${C.gray300}`,
              borderRadius: 6,
              background: "none",
              color: C.gray500,
              cursor: "pointer",
              fontSize: 13,
              padding: "6px 16px",
              width: "100%",
              marginBottom: 14,
              marginTop: 4,
            }}
          >
            + Add row
          </button>

          {entriesError && <ErrorBanner message={entriesError} />}
          {entriesSuccess && (
            <p
              style={{
                color: "#16a34a",
                fontSize: 13,
                margin: "0 0 10px",
                fontWeight: 500,
              }}
            >
              Entries saved successfully.
            </p>
          )}

          <PrimaryBtn
            onClick={handleSaveEntries}
            disabled={entriesMut.isPending}
          >
            {entriesMut.isPending
              ? "Saving…"
              : `Save ${draftRows.filter((r) => r.student_id.trim()).length || ""} Entries`}
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
