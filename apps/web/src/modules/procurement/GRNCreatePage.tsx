import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { createGRN, type GRNCondition } from "./procurement.api";

ensureGlobalCss();

interface GRNItemRow {
  description: string;
  quantity_received: string;
  quantity_ordered: string;
  condition: GRNCondition;
  notes: string;
}

const emptyItem = (): GRNItemRow => ({
  description: "", quantity_received: "1", quantity_ordered: "", condition: "good", notes: "",
});

export default function GRNCreatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    grn_number: "", received_by: "", received_date: "", notes: "",
  });
  const [items, setItems] = useState<GRNItemRow[]>([emptyItem()]);

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx: number, k: keyof GRNItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }
  function addItem() { setItems((rows) => [...rows, emptyItem()]); }
  function removeItem(idx: number) { setItems((rows) => rows.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createGRN({
        grn_number: form.grn_number,
        received_by: form.received_by || undefined,
        received_date: form.received_date || undefined,
        notes: form.notes || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity_received: Number(item.quantity_received) || 1,
          quantity_ordered: item.quantity_ordered ? Number(item.quantity_ordered) : undefined,
          condition: item.condition,
          notes: item.notes || undefined,
        })),
      });
      navigate(`/procurement/grns/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader title="New Goods Received Note" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>GRN Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="GRN Number *">
              <input value={form.grn_number} onChange={(e) => setF("grn_number", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Received By">
              <input value={form.received_by} onChange={(e) => setF("received_by", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Received Date">
              <input type="date" value={form.received_date} onChange={(e) => setF("received_date", e.target.value)} style={inputCss} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
          </Field>
        </Card>

        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Items Received</h3>
            <SecondaryBtn type="button" onClick={addItem}>+ Add Item</SecondaryBtn>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ border: "1px solid #dee2e6", borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 8 }}>
                <Field label="Description *">
                  <input value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} required style={inputCss} />
                </Field>
                <Field label="Qty Received">
                  <input type="number" min={0} value={item.quantity_received} onChange={(e) => setItem(idx, "quantity_received", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Qty Ordered">
                  <input type="number" min={0} value={item.quantity_ordered} onChange={(e) => setItem(idx, "quantity_ordered", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Condition">
                  <select value={item.condition} onChange={(e) => setItem(idx, "condition", e.target.value)} style={selectCss}>
                    <option value="good">Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
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
          <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Create GRN"}</PrimaryBtn>
          <SecondaryBtn type="button" onClick={() => navigate("/procurement")}>Cancel</SecondaryBtn>
        </div>
      </form>
    </div>
  );
}
