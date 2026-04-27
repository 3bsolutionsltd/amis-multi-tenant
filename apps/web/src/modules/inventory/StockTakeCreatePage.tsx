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
import { createStockTake, listInventoryItems } from "./inventory.api";

ensureGlobalCss();

interface StockTakeRow {
  item_id: string;
  department: string;
  expected_qty: string;
  counted_qty: string;
  condition: string;
  notes: string;
}

const emptyRow = (): StockTakeRow => ({
  item_id: "", department: "", expected_qty: "0", counted_qty: "", condition: "good", notes: "",
});

export default function StockTakeCreatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory.items.all"],
    queryFn: () => listInventoryItems({ include_inactive: false, limit: 200 }),
  });

  const [form, setForm] = useState({
    reference: "",
    title: "",
    financial_year: "",
    take_date: new Date().toISOString().slice(0, 10),
    conducted_by: "",
    notes: "",
  });
  const [rows, setRows] = useState<StockTakeRow[]>([]);

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setRow(idx: number, k: keyof StockTakeRow, v: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }
  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(idx: number) { setRows((rs) => rs.filter((_, i) => i !== idx)); }

  // Pre-fill expected_qty from current stock when item is selected
  function handleItemSelect(idx: number, itemId: string) {
    const found = inventoryItems.find((i) => i.id === itemId);
    setRows((rs) =>
      rs.map((r, i) =>
        i === idx
          ? { ...r, item_id: itemId, expected_qty: found ? String(found.current_stock) : "0" }
          : r,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createStockTake({
        reference: form.reference,
        title: form.title || undefined,
        financial_year: form.financial_year || undefined,
        take_date: form.take_date || undefined,
        conducted_by: form.conducted_by || undefined,
        notes: form.notes || undefined,
        items: rows
          .filter((r) => r.item_id)
          .map((r) => ({
            item_id: r.item_id,
            department: r.department || undefined,
            expected_qty: Number(r.expected_qty) || 0,
            counted_qty: r.counted_qty !== "" ? Number(r.counted_qty) : undefined,
            condition: r.condition || undefined,
            notes: r.notes || undefined,
          })),
      });
      navigate(`/inventory/stock-takes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stock take");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/inventory")}>← Back</SecondaryBtn>
        <PageHeader title="New Annual Stock Take" />
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Stock Take Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Reference *">
              <input
                value={form.reference}
                onChange={(e) => setF("reference", e.target.value)}
                required
                style={inputCss}
                placeholder="e.g. ST-2025/2026"
              />
            </Field>
            <Field label="Financial Year">
              <input
                value={form.financial_year}
                onChange={(e) => setF("financial_year", e.target.value)}
                style={inputCss}
                placeholder="e.g. 2025/2026"
              />
            </Field>
            <Field label="Take Date">
              <input
                type="date"
                value={form.take_date}
                onChange={(e) => setF("take_date", e.target.value)}
                style={inputCss}
              />
            </Field>
            <Field label="Title" style={{ gridColumn: "1 / -1" }}>
              <input
                value={form.title}
                onChange={(e) => setF("title", e.target.value)}
                style={inputCss}
                placeholder="e.g. Annual Stock Verification 2025/2026"
              />
            </Field>
            <Field label="Conducted By">
              <input
                value={form.conducted_by}
                onChange={(e) => setF("conducted_by", e.target.value)}
                style={inputCss}
                placeholder="Officer name"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setF("notes", e.target.value)}
              rows={2}
              style={{ ...inputCss, resize: "vertical" }}
            />
          </Field>
        </Card>

        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Item Counts</h3>
              <small style={{ color: "#6c757d" }}>
                Expected qty is pre-filled from current stock. Enter counted qty after physical verification.
              </small>
            </div>
            <SecondaryBtn type="button" onClick={addRow}>+ Add Item</SecondaryBtn>
          </div>

          {rows.length === 0 && (
            <p style={{ color: "#6c757d", textAlign: "center", padding: "20px 0" }}>
              No items added yet. You can add items now or after saving.
            </p>
          )}

          {rows.map((row, idx) => (
            <div key={idx} style={{ border: "1px solid #dee2e6", borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr 1fr 1fr 1fr", gap: 8 }}>
                <Field label="Item *">
                  <select
                    value={row.item_id}
                    onChange={(e) => handleItemSelect(idx, e.target.value)}
                    style={selectCss}
                  >
                    <option value="">— Select Item —</option>
                    {inventoryItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item_code ? `${i.item_code} — ` : ""}{i.name} ({i.unit_of_measure})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Department">
                  <input
                    value={row.department}
                    onChange={(e) => setRow(idx, "department", e.target.value)}
                    style={inputCss}
                    placeholder="e.g. Science Lab"
                  />
                </Field>
                <Field label="Expected Qty">
                  <input
                    type="number"
                    min={0}
                    value={row.expected_qty}
                    onChange={(e) => setRow(idx, "expected_qty", e.target.value)}
                    style={inputCss}
                  />
                </Field>
                <Field label="Counted Qty">
                  <input
                    type="number"
                    min={0}
                    value={row.counted_qty}
                    onChange={(e) => setRow(idx, "counted_qty", e.target.value)}
                    style={inputCss}
                    placeholder="—"
                  />
                </Field>
                <Field label="Condition">
                  <select value={row.condition} onChange={(e) => setRow(idx, "condition", e.target.value)} style={selectCss}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <SecondaryBtn type="button" onClick={() => removeRow(idx)}
                  style={{ fontSize: 12, padding: "2px 10px", color: "#dc3545", borderColor: "#dc3545" }}>
                  Remove
                </SecondaryBtn>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", gap: 12 }}>
          <PrimaryBtn type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Stock Take"}
          </PrimaryBtn>
          <SecondaryBtn type="button" onClick={() => navigate("/inventory")}>Cancel</SecondaryBtn>
        </div>
      </form>
    </div>
  );
}
