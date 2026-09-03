import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ensureGlobalCss,
  PageHeader,
  Field,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  inputCss,
  selectCss,
  Card,
} from "../../lib/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfig } from "../../app/ConfigProvider";
import { listAcademicYears } from "../academic-calendar/academic-calendar.api";
import { createRequisition, type PRPriority } from "./procurement.api";

ensureGlobalCss();

interface PRItemRow {
  description: string;
  vote_item: string;
  quantity: string;
  unit: string;
  estimated_unit_cost: string;
  notes: string;
}

const emptyItem = (): PRItemRow => ({
  description: "", vote_item: "", quantity: "1", unit: "pcs", estimated_unit_cost: "", notes: "",
});

export default function RequisitionCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments } = useConfig();
  const requesterName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
  });

  const [form, setForm] = useState({
    pr_number: "", title: "", department: "",
    requested_by: requesterName,
    priority: "normal" as PRPriority, academic_year: "", required_by: "", notes: "",
  });
  const [items, setItems] = useState<PRItemRow[]>([emptyItem()]);

  function setF(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setItem(idx: number, k: keyof PRItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }

  function addItem() { setItems((rows) => [...rows, emptyItem()]); }
  function removeItem(idx: number) { setItems((rows) => rows.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createRequisition({
        pr_number: form.pr_number,
        title: form.title,
        priority: form.priority,
        department: form.department || undefined,
        requested_by: form.requested_by || undefined,
        academic_year: form.academic_year || undefined,
        required_by: form.required_by || undefined,
        notes: form.notes || undefined,
        items: items.map((item) => ({
          description: item.description,
          vote_item: item.vote_item || undefined,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || undefined,
          estimated_unit_cost: item.estimated_unit_cost ? Number(item.estimated_unit_cost) : undefined,
          notes: item.notes || undefined,
        })),
      });
      navigate(`/procurement/requisitions/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader title="New Purchase Requisition" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Requisition Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="PR Number *">
              <input value={form.pr_number} onChange={(e) => setF("pr_number", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Title *">
              <input value={form.title} onChange={(e) => setF("title", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Department">
              {departments.length > 0 ? (
                <select value={form.department} onChange={(e) => setF("department", e.target.value)} style={selectCss}>
                  <option value="">— Select Department —</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input value={form.department} onChange={(e) => setF("department", e.target.value)} style={inputCss} />
              )}
            </Field>
            <Field label="Requested By">
              <input value={form.requested_by} readOnly style={{ ...inputCss, background: "#f8fafc", color: "#475569" }} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setF("priority", e.target.value)} style={selectCss}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Field label="Required By">
              <input type="date" value={form.required_by} onChange={(e) => setF("required_by", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Academic Year">
              {academicYears.length > 0 ? (
                <select value={form.academic_year} onChange={(e) => setF("academic_year", e.target.value)} style={selectCss}>
                  <option value="">— Select Year —</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.name}>{y.name}{y.is_current ? " (current)" : ""}</option>
                  ))}
                </select>
              ) : (
                <input value={form.academic_year} onChange={(e) => setF("academic_year", e.target.value)} placeholder="e.g. 2025/2026" style={inputCss} />
              )}
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
          </Field>
        </Card>

        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Items</h3>
            <SecondaryBtn type="button" onClick={addItem}>+ Add Item</SecondaryBtn>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ border: "1px solid #dee2e6", borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 2fr", gap: 8 }}>
                <Field label="Particulars (Description) *">
                  <input value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} required style={inputCss} />
                </Field>
                <Field label="Vote/Item">
                  <input value={item.vote_item} onChange={(e) => setItem(idx, "vote_item", e.target.value)} placeholder="e.g. 221001" style={inputCss} />
                </Field>
                <Field label="Qty">
                  <input type="number" min={1} value={item.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Unit">
                  <input value={item.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Est. Unit Cost (UGX)">
                  <input type="number" min={0} value={item.estimated_unit_cost} onChange={(e) => setItem(idx, "estimated_unit_cost", e.target.value)} style={inputCss} />
                </Field>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Field label="Notes" style={{ flex: 1, marginRight: 8 }}>
                  <input value={item.notes} onChange={(e) => setItem(idx, "notes", e.target.value)} style={inputCss} />
                </Field>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} style={{ color: "#dc3545", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", marginTop: 22 }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Create Requisition"}</PrimaryBtn>
          <SecondaryBtn type="button" onClick={() => navigate("/procurement")}>Cancel</SecondaryBtn>
        </div>
      </form>
    </div>
  );
}
