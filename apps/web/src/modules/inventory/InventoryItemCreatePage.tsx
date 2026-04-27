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
import { createInventoryItem, type InventoryCategory } from "./inventory.api";

ensureGlobalCss();

const CATEGORIES: InventoryCategory[] = [
  "stationery", "furniture", "equipment", "laboratory",
  "cleaning", "food", "uniform", "medical", "other",
];

export default function InventoryItemCreatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    item_code: "", name: "", description: "",
    category: "stationery" as InventoryCategory,
    unit_of_measure: "pcs", reorder_level: "10",
    unit_cost: "", notes: "",
  });

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createInventoryItem({
        item_code: form.item_code,
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        unit_of_measure: form.unit_of_measure,
        reorder_level: Number(form.reorder_level) || 0,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
        notes: form.notes || undefined,
      });
      navigate("/inventory");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <PageHeader title="Add Inventory Item" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Item Code *">
              <input value={form.item_code} onChange={(e) => setF("item_code", e.target.value)} required style={inputCss} placeholder="e.g. OFF-001" />
            </Field>
            <Field label="Name *">
              <input value={form.name} onChange={(e) => setF("name", e.target.value)} required style={inputCss} />
            </Field>
            <Field label="Category *">
              <select value={form.category} onChange={(e) => setF("category", e.target.value)} style={selectCss}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Unit of Measure *">
              <input value={form.unit_of_measure} onChange={(e) => setF("unit_of_measure", e.target.value)} required style={inputCss} placeholder="e.g. pcs, kg, litres" />
            </Field>
            <Field label="Reorder Level">
              <input type="number" min={0} value={form.reorder_level} onChange={(e) => setF("reorder_level", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Unit Cost (UGX)">
              <input type="number" min={0} value={form.unit_cost} onChange={(e) => setF("unit_cost", e.target.value)} style={inputCss} />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Add Item"}</PrimaryBtn>
            <SecondaryBtn type="button" onClick={() => navigate("/inventory")}>Cancel</SecondaryBtn>
          </div>
        </Card>
      </form>
    </div>
  );
}
