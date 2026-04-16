import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInstructorReports,
  createInstructorReport,
  updateInstructorReport,
  type InstructorReport,
  type CreateInstructorReportBody,
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
  SecondaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

function InstructorReportModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateInstructorReportBody>>({
    report_type: "weekly",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: keyof CreateInstructorReportBody, v: string) {
    setForm((f) => ({ ...f, [k]: v || undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.staff_id || !form.report_type || !form.period || !form.content) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createInstructorReport(form as CreateInstructorReportBody);
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
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>New Instructor Report</h2>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit}>
          <Field label="Staff ID *">
            <input
              style={inputCss}
              value={form.staff_id ?? ""}
              onChange={(e) => set("staff_id", e.target.value)}
              placeholder="UUID of staff member"
            />
          </Field>
          <Field label="Report Type *">
            <select
              style={selectCss}
              value={form.report_type ?? "weekly"}
              onChange={(e) => set("report_type", e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Period *">
            <input
              style={inputCss}
              value={form.period ?? ""}
              onChange={(e) => set("period", e.target.value)}
              placeholder="e.g. 2026-W15"
            />
          </Field>
          <Field label="Content *">
            <textarea
              style={{ ...inputCss, height: 90, resize: "vertical" }}
              value={form.content ?? ""}
              onChange={(e) => set("content", e.target.value)}
              placeholder="Report content…"
            />
          </Field>
          <Field label="Due Date">
            <input
              type="date"
              style={inputCss}
              value={form.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value)}
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
            <PrimaryBtn disabled={saving}>{saving ? "Saving…" : "Save Report"}</PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InstructorReportsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ["instructor-reports", filterStatus, filterType],
    queryFn: () =>
      listInstructorReports({
        status: (filterStatus as "draft" | "submitted") || undefined,
        report_type: (filterType as "weekly" | "monthly") || undefined,
      }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => updateInstructorReport(id, { status: "submitted" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-reports"] }),
  });

  const filtered = reports.filter((r: InstructorReport) =>
    !search ||
    r.period.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <C>
      <PageHeader
        title="Instructor Reports"
        subtitle="Weekly and monthly reports submitted by teaching staff"
        action={<PrimaryBtn onClick={() => setShowModal(true)}>+ New Report</PrimaryBtn>}
      />
      {showModal && (
        <InstructorReportModal
          onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["instructor-reports"] })}
        />
      )}
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by period or content…"
        />
        <select
          style={selectCss}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <select
          style={selectCss}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
        </select>
      </FilterBar>
      {error && <ErrorBanner message="Failed to load instructor reports." />}
      <Card>
        <DataTable
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          headers={["Period", "Type", "Status", "Due Date", "Actions"]}
        >
          {filtered.map((r: InstructorReport) => (
            <TR key={r.id}>
              <TD>{r.period}</TD>
              <TD>
                <Badge color={r.report_type === "weekly" ? "blue" : "purple"}>
                  {r.report_type === "weekly" ? "Weekly" : "Monthly"}
                </Badge>
              </TD>
              <TD>
                <Badge color={r.status === "submitted" ? "green" : "gray"}>
                  {r.status === "submitted" ? "Submitted" : "Draft"}
                </Badge>
              </TD>
              <TD>{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</TD>
              <TD>
                {r.status === "draft" && (
                  <SecondaryBtn
                    onClick={() => submitMutation.mutate(r.id)}
                    disabled={submitMutation.isPending}
                  >
                    Submit
                  </SecondaryBtn>
                )}
              </TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </C>
  );
}
