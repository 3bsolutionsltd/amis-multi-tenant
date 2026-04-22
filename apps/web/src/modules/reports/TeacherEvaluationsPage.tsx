import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEvaluations,
  createEvaluation,
  type TeacherEvaluation,
  type CreateEvaluationBody,
} from "./reports.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  PrimaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

function EvaluationModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateEvaluationBody & { scores_raw: string }>>({
    scores_raw: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v || undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student_id || !form.staff_id || !form.academic_period) {
      setError("Please fill in all required fields.");
      return;
    }
    let scores: Record<string, number> = {};
    try {
      scores = form.scores_raw ? JSON.parse(form.scores_raw) : {};
    } catch {
      setError("Scores must be valid JSON, e.g. {\"teaching_quality\":4}");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createEvaluation({
        student_id: form.student_id!,
        staff_id: form.staff_id!,
        academic_period: form.academic_period!,
        scores,
        comments: form.comments,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  };
  const modal: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    padding: 28,
    width: "100%",
    maxWidth: 520,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    maxHeight: "90vh",
    overflowY: "auto",
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
          Submit Teacher Evaluation
        </h2>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit}>
          <Field label="Student ID *">
            <input
              style={inputCss}
              value={form.student_id ?? ""}
              onChange={(e) => set("student_id", e.target.value)}
              placeholder="UUID of student"
            />
          </Field>
          <Field label="Staff ID *">
            <input
              style={inputCss}
              value={form.staff_id ?? ""}
              onChange={(e) => set("staff_id", e.target.value)}
              placeholder="UUID of staff member"
            />
          </Field>
          <Field label="Academic Period *">
            <input
              style={inputCss}
              value={form.academic_period ?? ""}
              onChange={(e) => set("academic_period", e.target.value)}
              placeholder="e.g. 2025/26 Sem 1"
            />
          </Field>
          <Field label="Scores (JSON)">
            <textarea
              style={{ ...inputCss, height: 70, resize: "vertical", fontFamily: "monospace" }}
              value={form.scores_raw ?? ""}
              onChange={(e) => set("scores_raw", e.target.value)}
              placeholder='{"teaching_quality": 4, "communication": 5}'
            />
          </Field>
          <Field label="Comments">
            <textarea
              style={{ ...inputCss, height: 60, resize: "vertical" }}
              value={form.comments ?? ""}
              onChange={(e) => set("comments", e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
            >
              Cancel
            </button>
            <PrimaryBtn disabled={saving}>{saving ? "Saving…" : "Submit"}</PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TeacherEvaluationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: evaluations = [], isLoading, error } = useQuery({
    queryKey: ["evaluations"],
    queryFn: () => listEvaluations(),
  });

  const filtered = evaluations.filter((e: TeacherEvaluation) =>
    !search || e.academic_period.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Teacher Evaluations"
        description="Student evaluations of teaching staff by academic period"
        action={<PrimaryBtn onClick={() => setShowModal(true)}>+ Submit Evaluation</PrimaryBtn>}
      />
      {showModal && (
        <EvaluationModal
          onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["evaluations"] })}
        />
      )}
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by academic period…"
        />
      </FilterBar>
      {error && <ErrorBanner message="Failed to load evaluations." />}
      <Card>
        <DataTable
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          headers={["Academic Period", "Student ID", "Staff ID", "Comments", "Submitted"]}
        >
          {filtered.map((e: TeacherEvaluation) => (
            <TR key={e.id}>
              <TD>{e.academic_period}</TD>
              <TD style={{ fontSize: 12, color: "#6b7280" }}>{e.student_id}</TD>
              <TD style={{ fontSize: 12, color: "#6b7280" }}>{e.staff_id}</TD>
              <TD>{e.comments ?? "—"}</TD>
              <TD>{e.submitted_at ? new Date(e.submitted_at).toLocaleDateString() : "—"}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
