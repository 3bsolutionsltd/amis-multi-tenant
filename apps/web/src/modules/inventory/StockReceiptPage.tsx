import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createTransaction, listInventoryItems } from "./inventory.api";

ensureGlobalCss();

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StockReceiptPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["inventory.items"],
    queryFn: () => listInventoryItems({ include_inactive: false }),
  });

  const [form, setForm] = useState({
    item_id: searchParams.get("item_id") ?? "",
    quantity: "",
    reference: "",
    performed_by: user?.email ?? "",
    transaction_date: today(),
    notes: "",
  });

  function setF(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const qty = Number(form.quantity);
    if (!form.item_id) { setError("Please select an item."); return; }
    if (!qty || qty <= 0) { setError("Quantity must be a positive number."); return; }

    setSaving(true);
    try {
      await createTransaction({
        item_id: form.item_id,
        transaction_type: "receipt",
        quantity: qty,
        reference: form.reference || undefined,
        performed_by: form.performed_by || undefined,
        transaction_date: form.transaction_date || undefined,
        notes: form.notes || undefined,
      });
      qc.invalidateQueries({ queryKey: ["inventory.transactions"] });
      qc.invalidateQueries({ queryKey: ["inventory.items"] });
      navigate("/inventory?tab=transactions");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = items.find((i) => i.id === form.item_id);

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <PageHeader
        title="Record Stock Receipt"
        subtitle="Record incoming stock (manual receipt or GRN receipt)"
      />

      <Card style={{ padding: 28 }}>
        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit}>
          <Field label="Item *">
            <select
              style={selectCss}
              value={form.item_id}
              onChange={(e) => setF("item_id", e.target.value)}
              required
            >
              <option value="">— Select Item —</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code ? `[${item.item_code}] ` : ""}{item.name}
                  {" "}({item.unit_of_measure})
                  {" — Current stock: "}{item.current_stock}
                </option>
              ))}
            </select>
            {selectedItem && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#6c757d" }}>
                Current stock:{" "}
                <strong style={{ color: selectedItem.current_stock <= selectedItem.reorder_level ? "#dc3545" : "#198754" }}>
                  {selectedItem.current_stock} {selectedItem.unit_of_measure}
                </strong>
                {selectedItem.current_stock <= selectedItem.reorder_level && (
                  <span style={{ marginLeft: 6, color: "#dc3545" }}>⚠️ Below reorder level ({selectedItem.reorder_level})</span>
                )}
              </div>
            )}
          </Field>

          <Field label="Quantity Received *">
            <input
              style={inputCss}
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 50"
              value={form.quantity}
              onChange={(e) => setF("quantity", e.target.value)}
              required
            />
          </Field>

          <Field label="GRN / Reference Number">
            <input
              style={inputCss}
              type="text"
              placeholder="e.g. GRN-2025-0042 or LPO number"
              value={form.reference}
              onChange={(e) => setF("reference", e.target.value)}
            />
          </Field>

          <Field label="Date Received">
            <input
              style={inputCss}
              type="date"
              value={form.transaction_date}
              onChange={(e) => setF("transaction_date", e.target.value)}
            />
          </Field>

          <Field label="Received By">
            <input
              style={inputCss}
              type="text"
              placeholder="Name of person receiving"
              value={form.performed_by}
              onChange={(e) => setF("performed_by", e.target.value)}
            />
          </Field>

          <Field label="Notes">
            <textarea
              style={{ ...inputCss, height: 80, resize: "vertical" }}
              placeholder="Condition notes, supplier details, etc."
              value={form.notes}
              onChange={(e) => setF("notes", e.target.value)}
            />
          </Field>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Record Receipt"}
            </PrimaryBtn>
            <SecondaryBtn type="button" onClick={() => navigate("/inventory?tab=transactions")}>
              Cancel
            </SecondaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
