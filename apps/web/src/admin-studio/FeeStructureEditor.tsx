import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";

/* ------------------------------------------------------------------ types */

interface AcademicYear { id: string; name: string; is_current: boolean }
interface Programme    { id: string; code: string; title: string }
interface Term         { id: string; name: string; term_number: number }

interface FeeStructure {
  id: string;
  academic_year_id: string;
  academic_year_name: string;
  term_id: string | null;
  programme_id: string;
  programme_code: string;
  programme_title: string;
  fee_type: string;
  description: string | null;
  amount: string;
  currency: string;
  is_active: boolean;
}

type FeeType = "tuition" | "functional" | "examination" | "other";

const FEE_TYPES: FeeType[] = ["tuition", "functional", "examination", "other"];

/* ------------------------------------------------------------------ styles */

const th: React.CSSProperties = {
  textAlign: "left", padding: "10px 14px",
  border: "1px solid #e2e8f0", fontWeight: 600,
  color: "#374151", background: "#f1f5f9", fontSize: 13,
};
const td: React.CSSProperties = {
  padding: "10px 14px", border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a",
};
const inputSt: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box",
};
const selectSt: React.CSSProperties = { ...inputSt };
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4,
};
const badgeStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
  background: active ? "#dcfce7" : "#fee2e2",
  color: active ? "#15803d" : "#dc2626",
});

/* ---------------------------------------------------------------- component */

export function FeeStructureEditor() {
  const qc = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<FeeStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    academic_year_id: "",
    term_id: "",
    programme_id: "",
    fee_type: "tuition" as FeeType,
    description: "",
    amount: "",
    currency: "UGX",
    is_active: true,
  });

  /* ---- queries ---- */

  const { data: years = [] } = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: () => apiFetch<AcademicYear[]>("/academic-years?limit=50"),
    staleTime: 60_000,
  });

  const { data: programmes = [] } = useQuery<Programme[]>({
    queryKey: ["programmes"],
    queryFn: () => apiFetch<Programme[]>("/programmes?limit=100"),
    staleTime: 60_000,
  });

  // Terms for selected year
  const { data: terms = [] } = useQuery<Term[]>({
    queryKey: ["terms", selectedYear || form.academic_year_id],
    queryFn: () => apiFetch<Term[]>(`/terms?academic_year_id=${selectedYear || form.academic_year_id}&limit=10`),
    enabled: !!(selectedYear || form.academic_year_id),
    staleTime: 60_000,
  });

  const { data: feeStructures = [], isLoading } = useQuery<FeeStructure[]>({
    queryKey: ["fee-structures", selectedYear],
    queryFn: () => selectedYear
      ? apiFetch<FeeStructure[]>(`/fee-structures?academic_year_id=${selectedYear}&include_inactive=true&limit=200`)
      : apiFetch<FeeStructure[]>("/fee-structures?include_inactive=true&limit=200"),
    staleTime: 30_000,
  });

  /* ---- mutations ---- */

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch<FeeStructure>("/fee-structures", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-structures"] });
      setSuccess("Fee structure created.");
      setShowForm(false);
      resetForm();
    },
    onError: () => setError("Failed to create fee structure"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch<FeeStructure>(`/fee-structures/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-structures"] });
      setSuccess("Fee structure updated.");
      setEditItem(null);
      setShowForm(false);
      resetForm();
    },
    onError: () => setError("Failed to update"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch(`/fee-structures/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-structures"] }),
  });

  /* ---- helpers ---- */

  function resetForm() {
    setForm({ academic_year_id: "", term_id: "", programme_id: "", fee_type: "tuition", description: "", amount: "", currency: "UGX", is_active: true });
  }

  function openEdit(item: FeeStructure) {
    setEditItem(item);
    setForm({
      academic_year_id: item.academic_year_id,
      term_id: item.term_id ?? "",
      programme_id: item.programme_id,
      fee_type: item.fee_type as FeeType,
      description: item.description ?? "",
      amount: item.amount,
      currency: item.currency,
      is_active: item.is_active,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const body = {
      academic_year_id: form.academic_year_id,
      term_id: form.term_id || null,
      programme_id: form.programme_id,
      fee_type: form.fee_type,
      description: form.description || null,
      amount: parseFloat(form.amount),
      currency: form.currency,
      is_active: form.is_active,
    };
    if (editItem) {
      updateMut.mutate({ id: editItem.id, body });
    } else {
      createMut.mutate(body);
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending;

  /* ---- grouped display ---- */
  const grouped: Record<string, FeeStructure[]> = {};
  for (const fs of feeStructures) {
    const key = fs.academic_year_name ?? fs.academic_year_id;
    (grouped[key] ??= []).push(fs);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Fee Structures</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Define fee schedules per programme, academic year, and fee type.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ ...selectSt, width: 160 }}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); resetForm(); setError(null); setSuccess(null); }}
            style={{ padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Add Fee Structure
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>{editItem ? "Edit Fee Structure" : "New Fee Structure"}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Academic Year *</label>
                <select required value={form.academic_year_id} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: e.target.value }))} style={selectSt}>
                  <option value="">Select year…</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Term (optional)</label>
                <select value={form.term_id} onChange={(e) => setForm((f) => ({ ...f, term_id: e.target.value }))} style={selectSt}>
                  <option value="">Year-level (no specific term)</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Programme *</label>
                <select required value={form.programme_id} onChange={(e) => setForm((f) => ({ ...f, programme_id: e.target.value }))} style={selectSt}>
                  <option value="">Select programme…</option>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Fee Type *</label>
                <select required value={form.fee_type} onChange={(e) => setForm((f) => ({ ...f, fee_type: e.target.value as FeeType }))} style={selectSt}>
                  {FEE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Amount ({form.currency}) *</label>
                <input required type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label style={labelSt}>Currency</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} style={selectSt}>
                  {["UGX", "USD", "KES", "TZS"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={inputSt} placeholder="Optional description" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="is_active" style={{ fontSize: 13, color: "#374151" }}>Active</label>
            </div>
            {error && <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={isBusy} style={{ padding: "9px 20px", background: isBusy ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: isBusy ? "not-allowed" : "pointer" }}>
                {isBusy ? "Saving…" : editItem ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditItem(null); resetForm(); }} style={{ padding: "9px 20px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          ✓ {success}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : feeStructures.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#94a3b8" }}>
          No fee structures yet. Click <strong>+ Add Fee Structure</strong> to create one.
        </div>
      ) : (
        Object.entries(grouped).map(([year, items]) => (
          <div key={year} style={{ marginBottom: 28 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              📅 {year}
            </h4>
            <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
              <thead>
                <tr>
                  <th style={th}>Programme</th>
                  <th style={th}>Fee Type</th>
                  <th style={th}>Term</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((fs) => (
                  <tr key={fs.id}>
                    <td style={td}><strong>{fs.programme_code}</strong> — {fs.programme_title}</td>
                    <td style={td}>{fs.fee_type.charAt(0).toUpperCase() + fs.fee_type.slice(1)}</td>
                    <td style={{ ...td, color: "#64748b" }}>{terms.find((t) => t.id === fs.term_id)?.name ?? "Year-level"}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fs.currency} {parseFloat(fs.amount).toLocaleString()}</td>
                    <td style={td}><span style={badgeStyle(fs.is_active)}>{fs.is_active ? "Active" : "Inactive"}</span></td>
                    <td style={td}>
                      <button onClick={() => openEdit(fs)} style={{ marginRight: 8, padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "#fff" }}>Edit</button>
                      <button onClick={() => toggleMut.mutate({ id: fs.id, is_active: !fs.is_active })} style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "#fff", color: fs.is_active ? "#dc2626" : "#16a34a" }}>
                        {fs.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
