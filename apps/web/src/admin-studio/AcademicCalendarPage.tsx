import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../lib/apiFetch";

/* ------------------------------------------------------------------ types */

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

/* ------------------------------------------------------------------ styles */

const inputSt: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4,
};
const cardSt: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 16,
};

function dateFmt(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

/* ---------------------------------------------------------------- component */

export function AcademicCalendarPage() {
  const qc = useQueryClient();

  const [showYearForm, setShowYearForm] = useState(false);
  const [yearForm, setYearForm] = useState({ name: "", start_date: "", end_date: "", is_current: false });
  const [yearError, setYearError] = useState<string | null>(null);

  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
  const [showTermForm, setShowTermForm] = useState<string | null>(null);
  const [termForm, setTermForm] = useState({ name: "", term_number: "1", start_date: "", end_date: "", is_current: false });
  const [termError, setTermError] = useState<string | null>(null);

  const [editYear, setEditYear] = useState<AcademicYear | null>(null);
  const [editTerm, setEditTerm] = useState<Term | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ---- queries ---- */

  const { data: years = [], isLoading } = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: () => apiFetch<AcademicYear[]>("/academic-years?limit=50"),
    staleTime: 30_000,
  });

  const { data: terms = [] } = useQuery<Term[]>({
    queryKey: ["terms-all"],
    queryFn: () => apiFetch<Term[]>("/terms?limit=200"),
    staleTime: 30_000,
  });

  /* ---- mutations ---- */

  const createYearMut = useMutation({
    mutationFn: (body: object) => apiFetch("/academic-years", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); setShowYearForm(false); resetYearForm(); setSuccessMsg("Academic year created."); },
    onError: () => setYearError("Failed to create academic year"),
  });

  const updateYearMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => apiFetch(`/academic-years/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); setEditYear(null); setSuccessMsg("Updated."); },
    onError: () => setYearError("Failed to update"),
  });

  const createTermMut = useMutation({
    mutationFn: (body: object) => apiFetch("/terms", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["terms-all"] }); setShowTermForm(null); resetTermForm(); setSuccessMsg("Term created."); },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setTermError("A term with that number already exists for this year (or only one current term allowed).");
        } else if (err.status === 422) {
          setTermError("Validation error. Check the academic year and dates.");
        } else if (err.status === 403) {
          setTermError("You do not have permission to create terms.");
        } else {
          setTermError(`Failed to create term (${err.status}). Please try again.`);
        }
      } else {
        setTermError("Failed to create term. Please check all fields and try again.");
      }
    },
  });

  const updateTermMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => apiFetch(`/terms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["terms-all"] }); setEditTerm(null); setSuccessMsg("Updated."); },
    onError: () => setTermError("Failed to update term"),
  });

  /* ---- helpers ---- */

  function resetYearForm() { setYearForm({ name: "", start_date: "", end_date: "", is_current: false }); }
  function resetTermForm() { setTermForm({ name: "", term_number: "1", start_date: "", end_date: "", is_current: false }); }

  function handleYearSubmit(e: React.FormEvent) {
    e.preventDefault(); setYearError(null); setSuccessMsg(null);
    const body = { name: yearForm.name, start_date: yearForm.start_date, end_date: yearForm.end_date, is_current: yearForm.is_current };
    if (editYear) { updateYearMut.mutate({ id: editYear.id, body }); }
    else { createYearMut.mutate(body); }
  }

  function handleTermSubmit(e: React.FormEvent) {
    e.preventDefault(); setTermError(null); setSuccessMsg(null);
    const yearId = showTermForm!;
    const body = {
      academic_year_id: yearId,
      name: termForm.name,
      term_number: parseInt(termForm.term_number),
      start_date: termForm.start_date,
      end_date: termForm.end_date,
      is_current: termForm.is_current,
    };
    if (editTerm) { updateTermMut.mutate({ id: editTerm.id, body }); }
    else { createTermMut.mutate(body); }
  }

  function openEditYear(y: AcademicYear) {
    setEditYear(y);
    setYearForm({ name: y.name, start_date: y.start_date?.slice(0, 10) ?? "", end_date: y.end_date?.slice(0, 10) ?? "", is_current: y.is_current });
    setShowYearForm(true);
    setYearError(null);
  }

  function openEditTerm(t: Term) {
    setEditTerm(t);
    setTermForm({ name: t.name, term_number: String(t.term_number), start_date: t.start_date?.slice(0, 10) ?? "", end_date: t.end_date?.slice(0, 10) ?? "", is_current: t.is_current });
    setShowTermForm(t.academic_year_id);
    setTermError(null);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Academic Calendar</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Manage academic years and terms. Mark the current active period.</p>
        </div>
        <button
          onClick={() => { setShowYearForm(true); setEditYear(null); resetYearForm(); setYearError(null); setSuccessMsg(null); }}
          style={{ padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + New Academic Year
        </button>
      </div>

      {/* Year form */}
      {showYearForm && (
        <div style={{ ...cardSt, background: "#f8fafc", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>{editYear ? "Edit Academic Year" : "Create Academic Year"}</h3>
          <form onSubmit={handleYearSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Year Name *</label>
                <input required value={yearForm.name} onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))} style={inputSt} placeholder="e.g. 2025/2026" />
              </div>
              <div>
                <label style={labelSt}>Start Date *</label>
                <input required type="date" value={yearForm.start_date} onChange={(e) => setYearForm((f) => ({ ...f, start_date: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>End Date *</label>
                <input required type="date" value={yearForm.end_date} onChange={(e) => setYearForm((f) => ({ ...f, end_date: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="ay_current" checked={yearForm.is_current} onChange={(e) => setYearForm((f) => ({ ...f, is_current: e.target.checked }))} />
              <label htmlFor="ay_current" style={{ fontSize: 13, color: "#374151" }}>Mark as current academic year (clears others)</label>
            </div>
            {yearError && <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{yearError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={createYearMut.isPending || updateYearMut.isPending} style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {createYearMut.isPending || updateYearMut.isPending ? "Saving…" : editYear ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowYearForm(false); setEditYear(null); }} style={{ padding: "8px 18px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Year list */}
      {isLoading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : years.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#94a3b8" }}>
          No academic years yet. Click <strong>+ New Academic Year</strong> to get started.
        </div>
      ) : (
        years.map((year) => {
          const yearTerms = terms.filter((t) => t.academic_year_id === year.id);
          const isExpanded = !collapsedYears.has(year.id);
          return (
            <div key={year.id} style={cardSt}>
              {/* Year header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setCollapsedYears((prev) => { const next = new Set(prev); if (next.has(year.id)) next.delete(year.id); else next.add(year.id); return next; })}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748b", padding: "0 4px" }}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{year.name}</span>
                    {year.is_current && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>CURRENT</span>
                    )}
                    {yearTerms.length > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 600, border: "1px solid #bbf7d0" }}>
                        {yearTerms.length} term{yearTerms.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span style={{ marginLeft: 12, fontSize: 12, color: "#64748b" }}>
                      {dateFmt(year.start_date)} → {dateFmt(year.end_date)}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEditYear(year)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "#fff" }}>Edit</button>
                  <button
                    onClick={() => { setShowTermForm(year.id); setEditTerm(null); resetTermForm(); setTermError(null); }}
                    style={{ padding: "5px 12px", fontSize: 12, border: "none", borderRadius: 5, cursor: "pointer", background: "#2563eb", color: "#fff", fontWeight: 700 }}
                  >
                    + Add Term
                  </button>
                </div>
              </div>

              {/* Term form (inline) */}
              {showTermForm === year.id && (
                <div style={{ marginTop: 14, padding: 16, background: "#f1f5f9", borderRadius: 8 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>{editTerm ? "Edit Term" : "New Term"}</h4>
                  <form onSubmit={handleTermSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelSt}>Term Name *</label>
                        <input required value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} style={inputSt} placeholder="e.g. Semester I" />
                      </div>
                      <div>
                        <label style={labelSt}>Term Number *</label>
                        <input required type="number" min={1} max={4} value={termForm.term_number} onChange={(e) => setTermForm((f) => ({ ...f, term_number: e.target.value }))} style={inputSt} />
                      </div>
                      <div>
                        <label style={labelSt}>Start Date *</label>
                        <input required type="date" value={termForm.start_date} onChange={(e) => setTermForm((f) => ({ ...f, start_date: e.target.value }))} style={inputSt} />
                      </div>
                      <div>
                        <label style={labelSt}>End Date *</label>
                        <input required type="date" value={termForm.end_date} onChange={(e) => setTermForm((f) => ({ ...f, end_date: e.target.value }))} style={inputSt} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <input type="checkbox" id={`term_current_${year.id}`} checked={termForm.is_current} onChange={(e) => setTermForm((f) => ({ ...f, is_current: e.target.checked }))} />
                      <label htmlFor={`term_current_${year.id}`} style={{ fontSize: 13, color: "#374151" }}>Mark as current term</label>
                    </div>
                    {termError && <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 13, marginBottom: 10 }}>{termError}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" disabled={createTermMut.isPending || updateTermMut.isPending} style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {createTermMut.isPending || updateTermMut.isPending ? "Saving…" : editTerm ? "Update" : "Create Term"}
                      </button>
                      <button type="button" onClick={() => { setShowTermForm(null); setEditTerm(null); }} style={{ padding: "7px 14px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Terms list — always visible */}
              {isExpanded && yearTerms.length > 0 && (
                <div style={{ marginTop: 14, paddingLeft: 32 }}>
                  {yearTerms
                    .sort((a, b) => a.term_number - b.term_number)
                    .map((term) => (
                      <div key={term.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 7, marginBottom: 6, border: "1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{term.name}</span>
                          <span style={{ marginLeft: 6, color: "#64748b", fontSize: 12 }}>({dateFmt(term.start_date)} → {dateFmt(term.end_date)})</span>
                          {term.is_current && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#fef9c3", color: "#854d0e", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>CURRENT</span>
                          )}
                        </div>
                        <button onClick={() => openEditTerm(term)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "#fff" }}>Edit</button>
                      </div>
                    ))}
                </div>
              )}
              {isExpanded && yearTerms.length === 0 && (
                <p style={{ paddingLeft: 40, color: "#94a3b8", fontSize: 13, marginTop: 10 }}>No terms yet. Click <strong>+ Add Term</strong>.</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
