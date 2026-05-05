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
import { createIssuance, listInventoryItems } from "./inventory.api";
import { listSRQs } from "../stores/stores.api";

ensureGlobalCss();

interface IssuanceItemRow {
  item_id: string;
  quantity_requested: string;
  quantity_issued: string;
  notes: string;
}

const emptyItem = (): IssuanceItemRow => ({
  item_id: "", quantity_requested: "1", quantity_issued: "1", notes: "",
});

export default function IssuanceCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments } = useConfig();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory.items"],
    queryFn: () => listInventoryItems({}),
  });

  const [form, setForm] = useState({
    issuance_number: "", issued_to: "",
    issued_by: user?.email ?? "",
    department: "", requisition_ref: "", purpose: "", issue_date: "", notes: "",
    srq_id: "",
  });

  const { data: approvedSRQs = [] } = useQuery({
    queryKey: ["srqs", "hod_approved"],
    queryFn: () => listSRQs({ status: "hod_approved" }),
  });
  const [items, setItems] = useState<IssuanceItemRow[]>([emptyItem()]);

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx: number, k: keyof IssuanceItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }
  function addItem() { setItems((rows) => [...rows, emptyItem()]); }
  function removeItem(idx: number) { setItems((rows) => rows.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createIssuance({
        issuance_number: form.issuance_number,
        issued_to: form.issued_to || undefined,
        issued_by: form.issued_by || undefined,
        department: form.department || undefined,
        requisition_ref: form.requisition_ref || undefined,
        srq_id: form.srq_id || undefined,
        purpose: form.purpose || undefined,
        issue_date: form.issue_date || undefined,
        notes: form.notes || undefined,
        items: items.map((item) => ({
          item_id: item.item_id,
          quantity_requested: Number(item.quantity_requested) || 1,
          quantity_issued: Number(item.quantity_issued) || 0,
          notes: item.notes || undefined,
        })),
      });
      navigate(`/inventory`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader title="New Goods Issue Note (GIN)" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Issuance Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="GIN Number *">
              <input value={form.issuance_number} onChange={(e) => setF("issuance_number", e.target.value)} required style={inputCss} placeholder="e.g. GIN-2025-001" />
            </Field>
            <Field label="Issue Date">
              <input type="date" value={form.issue_date} onChange={(e) => setF("issue_date", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Issued To (Received By) *">
              <input value={form.issued_to} onChange={(e) => setF("issued_to", e.target.value)} required style={inputCss} placeholder="Person receiving items" />
            </Field>
            <Field label="Inventory Officer (Issued By)">
              <input value={form.issued_by} onChange={(e) => setF("issued_by", e.target.value)} style={inputCss} placeholder="Store officer" />
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
                <input value={form.department} onChange={(e) => setF("department", e.target.value)} style={inputCss} placeholder="e.g. Science, Admin, Library" />
              )}
            </Field>
            <Field label="Link to Store Requisition (SRQ)">
              <select
                value={form.srq_id}
                onChange={(e) => {
                  const selected = approvedSRQs.find((s) => s.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    srq_id: e.target.value,
                    requisition_ref: selected ? selected.srq_number : f.requisition_ref,
                    department: selected?.department ?? f.department,
                    purpose: selected?.purpose ?? f.purpose,
                  }));
                }}
                style={selectCss}
              >
                <option value="">— None —</option>
                {approvedSRQs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.srq_number}{s.department ? ` · ${s.department}` : ""}{s.purpose ? ` — ${s.purpose}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Requisition No.">
              <input value={form.requisition_ref} onChange={(e) => setF("requisition_ref", e.target.value)} style={inputCss} placeholder="e.g. SRQ-2026-001 or PR-2025-042" />
            </Field>
            <Field label="Purpose" style={{ gridColumn: "1 / -1" }}>
              <input value={form.purpose} onChange={(e) => setF("purpose", e.target.value)} style={inputCss} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
          </Field>
        </Card>

        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Items to Issue</h3>
            <SecondaryBtn type="button" onClick={addItem}>+ Add Item</SecondaryBtn>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ border: "1px solid #dee2e6", borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: 8 }}>
                <Field label="Item *">
                  <select value={item.item_id} onChange={(e) => setItem(idx, "item_id", e.target.value)} required style={selectCss}>
                    <option value="">— Select Item —</option>
                    {inventoryItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item_code} — {i.name} (Stock: {i.current_stock} {i.unit_of_measure})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Qty Requested">
                  <input type="number" min={1} value={item.quantity_requested} onChange={(e) => setItem(idx, "quantity_requested", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Qty to Issue">
                  <input type="number" min={0} value={item.quantity_issued} onChange={(e) => setItem(idx, "quantity_issued", e.target.value)} style={inputCss} />
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
          <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Save Goods Issue Note"}</PrimaryBtn>
          <SecondaryBtn type="button" onClick={() => navigate("/inventory")}>Cancel</SecondaryBtn>
        </div>
      </form>
    </div>
  );
}
