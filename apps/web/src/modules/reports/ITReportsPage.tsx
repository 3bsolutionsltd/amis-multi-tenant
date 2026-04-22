import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listITReports,
  createITReport,
  type ITReport,
  type CreateITReportBody,
} from "./reports.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Badge,
  PrimaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

const REPORT_TYPE_LABELS: Record<string, string> = {
  student: "Student",
  supervisor: "Supervisor",
};

function ITReportModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateITReportBody>>({
    report_type: "student",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: keyof CreateITReportBody, v: string | number) {
    setForm((f) => ({ ...f, [k]: v || undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.industrial_training_id ||
      !form.report_type ||
      !form.period ||
      !form.summary ||
      !form.submitted_by
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createITReport(form as CreateITReportBody);
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
    maxWidth: 540,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    maxHeight: "90vh",
    overflowY: "auto",
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>New IT Report</h2>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit}>
          <Field label="Industrial Training ID *">
            <input
              style={inputCss}
              value={form.industrial_training_id ?? ""}
              onChange={(e) => set("industrial_training_id", e.target.value)}
              placeholder="UUID of IT record"
            />
          </Field>
          <Field label="Report Type *">
            <select
              style={selectCss}
              value={form.report_type ?? "student"}
              onChange={(e) => set("report_type", e.target.value)}
            >
              <option value="student">Student</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </Field>
          <Field label="Period *">
            <input
              style={inputCss}
              value={form.period ?? ""}
              onChange={(e) => set("period", e.target.value)}
              placeholder="e.g. Week 1"
            />
          </Field>
          <Field label="Summary *">
            <textarea
              style={{ ...inputCss, height: 80, resize: "vertical" }}
              value={form.summary ?? ""}
              onChange={(e) => set("summary", e.target.value)}
            />
          </Field>
          <Field label="Challenges">
            <textarea
              style={{ ...inputCss, height: 60, resize: "vertical" }}
              value={form.challenges ?? ""}
              onChange={(e) => set("challenges", e.target.value)}
            />
          </Field>
          <Field label="Recommendations">
            <textarea
              style={{ ...inputCss, height: 60, resize: "vertical" }}
              value={form.recommendations ?? ""}
              onChange={(e) => set("recommendations", e.target.value)}
            />
          </Field>
          <Field label="Rating (1–5)">
            <input
              type="number"
              min={1}
              max={5}
              style={inputCss}
              value={form.rating ?? ""}
              onChange={(e) => set("rating", Number(e.target.value))}
            />
          </Field>
          <Field label="Submitted By *">
            <input
              style={inputCss}
              value={form.submitted_by ?? ""}
              onChange={(e) => set("submitted_by", e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
              Cancel
            </button>
            <PrimaryBtn disabled={saving}>{saving ? "Saving…" : "Save Report"}</PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ITReportsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ["it-reports", filterType],
    queryFn: () => listITReports({ report_type: filterType as "student" | "supervisor" || undefined }),
  });

  const filtered = reports.filter((r: ITReport) =>
    !search || r.period.toLowerCase().includes(search.toLowerCase()) || r.submitted_by.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="IT Progress Reports"
        description="Industrial training progress reports from students and supervisors"
        action={<PrimaryBtn onClick={() => setShowModal(true)}>+ New Report</PrimaryBtn>}
      />
      {showModal && (
        <ITReportModal
          onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["it-reports"] })}
        />
      )}
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by period or submitter…"
        />
        <select
          style={selectCss}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="student">Student</option>
          <option value="supervisor">Supervisor</option>
        </select>
      </FilterBar>
      {error && <ErrorBanner message="Failed to load IT reports." />}
      <Card>
        <DataTable
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          headers={["Period", "Type", "Submitted By", "Rating", "Date"]}
        >
          {filtered.map((r: ITReport) => (
            <TR key={r.id}>
              <TD>{r.period}</TD>
              <TD>
                <Badge label={REPORT_TYPE_LABELS[r.report_type] ?? r.report_type} color={r.report_type === "student" ? "blue" : "green"} />
              </TD>
              <TD>{r.submitted_by}</TD>
              <TD>{r.rating != null ? `${r.rating}/5` : "—"}</TD>
              <TD>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
