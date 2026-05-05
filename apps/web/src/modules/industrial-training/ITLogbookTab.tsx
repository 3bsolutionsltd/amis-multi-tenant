import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listLogEntries,
  createLogEntry,
  updateLogEntry,
  verifyLogEntry,
  setSupervisorPin,
  type LogEntry,
} from "./industrial-training.api";
import {
  Card,
  SectionLabel,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Spinner,
  Field,
  inputCss,
  C,
  Badge,
} from "../../lib/ui";

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---- Set PIN modal -------------------------------------------------------
function SetPinModal({
  assignmentId,
  onClose,
}: {
  assignmentId: string;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => setSupervisorPin(assignmentId, pin),
    onSuccess: () => onClose(),
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 28,
          width: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        }}
      >
        <SectionLabel>Set Supervisor PIN</SectionLabel>
        <p style={{ fontSize: 13, color: C.gray500, marginBottom: 16 }}>
          The supervisor will use this PIN to verify daily log entries.
          Choose a 4–8 digit numeric PIN.
        </p>
        {err && <ErrorBanner message={err} />}
        <Field label="PIN (4–8 digits)">
          <input
            type="password"
            inputMode="numeric"
            style={inputCss}
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn
            onClick={() => mut.mutate()}
            disabled={pin.length < 4 || mut.isPending}
          >
            {mut.isPending ? "Saving…" : "Save PIN"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ---- Verify modal --------------------------------------------------------
function VerifyModal({
  logId,
  logDate,
  onClose,
}: {
  logId: string;
  logDate: string;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => verifyLogEntry(logId, pin),
    onSuccess: (_, __, ___) => {
      qc.invalidateQueries({ queryKey: ["itLogbook"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Verification failed — wrong PIN?"),
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 28,
          width: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        }}
      >
        <SectionLabel>Verify Log — {fmt(logDate)}</SectionLabel>
        <p style={{ fontSize: 13, color: C.gray500, marginBottom: 16 }}>
          Enter the supervisor PIN to verify this log entry.
        </p>
        {err && <ErrorBanner message={err} />}
        <Field label="Supervisor PIN">
          <input
            type="password"
            inputMode="numeric"
            style={inputCss}
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn
            onClick={() => mut.mutate()}
            disabled={pin.length < 4 || mut.isPending}
          >
            {mut.isPending ? "Verifying…" : "Verify"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ---- Add / Edit log entry form -------------------------------------------
function LogEntryForm({
  assignmentId,
  existing,
  onDone,
}: {
  assignmentId: string;
  existing?: LogEntry;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(existing?.log_date ?? "");
  const [task, setTask] = useState(existing?.task_description ?? "");
  const [points, setPoints] = useState(existing?.learning_points ?? "");
  const [err, setErr] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      createLogEntry(assignmentId, {
        log_date: date,
        task_description: task,
        learning_points: points || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itLogbook", assignmentId] });
      onDone();
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  const editMut = useMutation({
    mutationFn: () =>
      updateLogEntry(existing!.id, {
        task_description: task,
        learning_points: points || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itLogbook", assignmentId] });
      onDone();
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  const isPending = createMut.isPending || editMut.isPending;

  return (
    <Card padding="16px 20px" style={{ marginBottom: 16, background: C.gray50 }}>
      <SectionLabel>{existing ? "Edit Log Entry" : "New Log Entry"}</SectionLabel>
      {err && <ErrorBanner message={err} />}
      {!existing && (
        <Field label="Date" required>
          <input
            type="date"
            style={inputCss}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      )}
      <Field label="Task Description" required>
        <textarea
          style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe what you did today…"
        />
      </Field>
      <Field label="Learning Points">
        <textarea
          style={{ ...inputCss, minHeight: 60, resize: "vertical" }}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="What did you learn?"
        />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <PrimaryBtn
          onClick={() => (existing ? editMut.mutate() : createMut.mutate())}
          disabled={!task.trim() || (!existing && !date) || isPending}
        >
          {isPending ? "Saving…" : existing ? "Save Changes" : "Add Entry"}
        </PrimaryBtn>
        <SecondaryBtn onClick={onDone}>Cancel</SecondaryBtn>
      </div>
    </Card>
  );
}

// ---- Main tab component --------------------------------------------------
export function ITLogbookTab({ assignmentId }: { assignmentId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [verifyEntry, setVerifyEntry] = useState<LogEntry | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["itLogbook", assignmentId],
    queryFn: () => listLogEntries(assignmentId),
    enabled: !!assignmentId,
  });

  const verified = data?.filter((e) => e.supervisor_verified).length ?? 0;
  const total = data?.length ?? 0;
  const rate = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <div>
      {showPinModal && (
        <SetPinModal
          assignmentId={assignmentId}
          onClose={() => setShowPinModal(false)}
        />
      )}
      {verifyEntry && (
        <VerifyModal
          logId={verifyEntry.id}
          logDate={verifyEntry.log_date}
          onClose={() => setVerifyEntry(null)}
        />
      )}

      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <SectionLabel>Logbook Entries</SectionLabel>
          {total > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray500 }}>
              {verified}/{total} verified ({rate}%)
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <SecondaryBtn onClick={() => setShowPinModal(true)}>
            Set Supervisor PIN
          </SecondaryBtn>
          {!showForm && !editEntry && (
            <PrimaryBtn onClick={() => setShowForm(true)}>
              + Add Entry
            </PrimaryBtn>
          )}
        </div>
      </div>

      {/* Add form */}
      {showForm && !editEntry && (
        <LogEntryForm
          assignmentId={assignmentId}
          onDone={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editEntry && (
        <LogEntryForm
          assignmentId={assignmentId}
          existing={editEntry}
          onDone={() => setEditEntry(null)}
        />
      )}

      {/* List */}
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: C.gray400,
            fontSize: 14,
          }}
        >
          No log entries yet. Add the first entry above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((entry) => (
            <Card key={entry.id} padding="14px 18px">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: C.gray900,
                      }}
                    >
                      {fmt(entry.log_date)}
                    </span>
                    <Badge
                      label={entry.supervisor_verified ? "Verified" : "Pending"}
                      color={entry.supervisor_verified ? "green" : "gray"}
                    />
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 14, color: C.gray700 }}>
                    {entry.task_description}
                  </p>
                  {entry.learning_points && (
                    <p style={{ margin: 0, fontSize: 13, color: C.gray500 }}>
                      <em>Learning: </em>
                      {entry.learning_points}
                    </p>
                  )}
                  {entry.supervisor_verified && entry.verified_at && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: C.green }}>
                      Verified {fmt(entry.verified_at)}
                      {entry.verified_by_name ? ` by ${entry.verified_by_name}` : ""}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!entry.supervisor_verified && (
                    <>
                      <SecondaryBtn onClick={() => setEditEntry(entry)}>
                        Edit
                      </SecondaryBtn>
                      <PrimaryBtn onClick={() => setVerifyEntry(entry)}>
                        Verify
                      </PrimaryBtn>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
