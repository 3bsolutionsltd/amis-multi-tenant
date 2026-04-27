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
import { createOrder, listSuppliers } from "./procurement.api";

ensureGlobalCss();

interface POItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  notes: string;
}

const emptyItem = (): POItemRow => ({
  description: "", quantity: "1", unit: "pcs", unit_price: "", notes: "",
});

export default function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["procurement.suppliers"],
    queryFn: () => listSuppliers(),
  });

  const [form, setForm] = useState({
    po_number: "", title: "", supplier_id: "",
    order_date: "", expected_delivery_date: "", notes: "",
  });
  const [items, setItems] = useState<POItemRow[]>([emptyItem()]);

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx: number, k: keyof POItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }
  function addItem() { setItems((rows) => [...rows, emptyItem()]); }
  function removeItem(idx: number) { setItems((rows) => rows.filter((_, i) => i !== idx)); }

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createOrder({
        po_number: form.po_number,
        title: form.title,
        supplier_id: form.supplier_id || undefined,
        order_date: form.order_date || undefined,
        expected_delivery_date: form.expected_delivery_date || undefined,
        notes: form.notes || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || undefined,
          unit_price: Number(item.unit_price) || 0,
          notes: item.notes || undefined,
        })),
      });
      navigate(`/procurement/orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader title="New Local Purchase Order (LPO)" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>LPO Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="LPO Number *">
              <input value={form.po_number} onChange={(e) => setF("po_number", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Title *">
              <input value={form.title} onChange={(e) => setF("title", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Supplier">
              <select value={form.supplier_id} onChange={(e) => setF("supplier_id", e.target.value)} style={selectCss}>
                <option value="">— Select Supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Order Date">
              <input type="date" value={form.order_date} onChange={(e) => setF("order_date", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Expected Delivery">
              <input type="date" value={form.expected_delivery_date} onChange={(e) => setF("expected_delivery_date", e.target.value)} style={inputCss} />
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
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 2fr", gap: 8 }}>
                <Field label="Description *">
                  <input value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} required style={inputCss} />
                </Field>
                <Field label="Qty">
                  <input type="number" min={1} value={item.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Unit">
                  <input value={item.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Unit Price (UGX)">
                  <input type="number" min={0} value={item.unit_price} onChange={(e) => setItem(idx, "unit_price", e.target.value)} style={inputCss} />
                </Field>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontWeight: 600, color: "#198754" }}>
                  Line total: UGX {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} style={{ color: "#dc3545", background: "none", border: "none", cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ textAlign: "right", fontWeight: 700, fontSize: 16 }}>
            Total: UGX {total.toLocaleString()}
          </div>
        </Card>

        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Create Order"}</PrimaryBtn>
          <SecondaryBtn type="button" onClick={() => navigate("/procurement")}>Cancel</SecondaryBtn>
        </div>
      </form>
    </div>
  );
}
