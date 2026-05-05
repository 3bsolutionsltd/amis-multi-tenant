import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ensureGlobalCss, PageHeader, Card, DataTable, TR, TD, Badge,
  PrimaryBtn, SecondaryBtn, ErrorBanner, Field, inputCss, selectCss,
  SectionLabel, C,
} from "../../lib/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfig } from "../../app/ConfigProvider";
import { listInventoryItems } from "../inventory/inventory.api";
import { listSRQs, createSRQ, type SRQStatus } from "./stores.api";

ensureGlobalCss();

const STATUS_COLORS: Record<SRQStatus, "gray" | "blue" | "yellow" | "green" | "red" | "cyan"> = {
  draft: "gray",
  submitted: "blue",
  hod_approved: "cyan",
  fulfilled: "green",
  rejected: "red",
  escalated_to_pr: "yellow",
};

const STATUS_LABELS: Record<SRQStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  hod_approved: "HOD Approved",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  escalated_to_pr: "Escalated → PR",
};

interface ItemRow {
  item_id: string;
  description: string;
  quantity_requested: string;
  unit: string;
  unit_cost: string;
}

const emptyItem = (): ItemRow => ({
  item_id: "", description: "", quantity_requested: "1", unit: "units", unit_cost: "",
});

export function SRQListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { departments } = useConfig();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    srq_number: "", requested_by: user?.email ?? "",
    department: "", purpose: "", required_date: "", notes: "",
  });
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  const { data: srqs = [], isLoading } = useQuery({
    queryKey: ["srqs", statusFilter],
    queryFn: () => listSRQs({ status: statusFilter || undefined }),
  });

  const { data: invItems = [] } = useQuery({
    queryKey: ["inventory.items"],
    queryFn: () => listInventoryItems({}),
    enabled: showForm,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSRQ({
        srq_number: form.srq_number,
        requested_by: form.requested_by,
        department: form.department || undefined,
        purpose: form.purpose || undefined,
        required_date: form.required_date || undefined,
        notes: form.notes || undefined,
        items: items.map((r) => ({
          item_id: r.item_id || undefined,
          description: r.description,
          quantity_requested: Number(r.quantity_requested) || 1,
          unit: r.unit,
          unit_cost: r.unit_cost ? Number(r.unit_cost) : undefined,
        })),
      }),
    onSuccess: (srq) => {
      qc.invalidateQueries({ queryKey: ["srqs"] });
      setShowForm(false);
      setForm({ srq_number: "", requested_by: user?.email ?? "", department: "", purpose: "", required_date: "", notes: "" });
      setItems([emptyItem()]);
      setError(null);
      navigate(`/stores/requisitions/${srq.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx: number, k: keyof ItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }
  function syncItemFromCatalog(idx: number, itemId: string) {
    const inv = invItems.find((i) => i.id === itemId);
    if (inv) {
      setItems((rows) =>
        rows.map((r, i) =>
          i === idx
            ? { ...r, item_id: itemId, description: inv.name, unit: inv.unit_of_measure, unit_cost: inv.unit_cost ? String(inv.unit_cost) : "" }
            : r
        )
      );
    } else {
      setItem(idx, "item_id", itemId);
    }
  }

  const statuses: Array<{ label: string; value: string }> = [
    { label: "All", value: "" },
    { label: "Draft", value: "draft" },
    { label: "Submitted", value: "submitted" },
    { label: "HOD Approved", value: "hod_approved" },
    { label: "Fulfilled", value: "fulfilled" },
    { label: "Escalated → PR", value: "escalated_to_pr" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Store Requisitions (SRQ)"
        action={
          <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New SRQ"}
          </PrimaryBtn>
        }
      />

      {showForm && (
        <Card padding="20px 24px" style={{ marginBottom: 24 }}>
          <SectionLabel>New Store Requisition</SectionLabel>
          {error && <ErrorBanner message={error} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="SRQ Number *">
              <input value={form.srq_number} onChange={(e) => setF("srq_number", e.target.value)} style={inputCss} placeholder="e.g. SRQ-2026-001" required />
            </Field>
            <Field label="Requested By *">
              <input value={form.requested_by} onChange={(e) => setF("requested_by", e.target.value)} style={inputCss} required />
            </Field>
            <Field label="Department">
              {departments.length > 0 ? (
                <select value={form.department} onChange={(e) => setF("department", e.target.value)} style={selectCss}>
                  <option value="">— Select —</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input value={form.department} onChange={(e) => setF("department", e.target.value)} style={inputCss} placeholder="e.g. Engineering" />
              )}
            </Field>
            <Field label="Required By Date">
              <input type="date" value={form.required_date} onChange={(e) => setF("required_date", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Purpose" style={{ gridColumn: "1 / -1" }}>
              <input value={form.purpose} onChange={(e) => setF("purpose", e.target.value)} style={inputCss} />
            </Field>
            <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
              <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
            </Field>
          </div>

          {/* Items */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <SectionLabel>Items Requested</SectionLabel>
              <SecondaryBtn type="button" onClick={() => setItems((r) => [...r, emptyItem()])}>+ Add Item</SecondaryBtn>
            </div>
            {items.map((item, idx) => (
              <div key={idx} style={{ border: `1px solid ${C.gray200}`, borderRadius: 6, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <Field label="From Catalog (optional)">
                    <select
                      value={item.item_id}
                      onChange={(e) => syncItemFromCatalog(idx, e.target.value)}
                      style={selectCss}
                    >
                      <option value="">— Free text —</option>
                      {invItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.item_code ? `${i.item_code} — ` : ""}{i.name} (Stock: {i.current_stock})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description *">
                    <input value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} style={inputCss} required />
                  </Field>
                  <Field label="Qty">
                    <input type="number" min={0.001} step="any" value={item.quantity_requested} onChange={(e) => setItem(idx, "quantity_requested", e.target.value)} style={inputCss} />
                  </Field>
                  <Field label="Unit">
                    <input value={item.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} style={inputCss} />
                  </Field>
                  <Field label="Est. Unit Cost">
                    <input type="number" min={0} step="any" value={item.unit_cost} onChange={(e) => setItem(idx, "unit_cost", e.target.value)} style={inputCss} placeholder="0.00" />
                  </Field>
                  <div style={{ paddingBottom: 4 }}>
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((r) => r.filter((_, i) => i !== idx))}
                        style={{ color: C.red, background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <PrimaryBtn onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.srq_number || !form.requested_by}>
              {createMut.isPending ? "Saving…" : "Save SRQ"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => { setShowForm(false); setError(null); }}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            style={{
              padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13,
              background: statusFilter === s.value ? C.primary : C.gray100,
              color: statusFilter === s.value ? "#fff" : C.gray700,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card padding="0">
        <DataTable headers={["SRQ #", "Requested By", "Department", "Purpose", "Status", "Date"]}>
          {isLoading ? (
            <TR><TD colSpan={6} style={{ textAlign: "center", color: C.gray400 }}>Loading…</TD></TR>
          ) : srqs.length === 0 ? (
            <TR><TD colSpan={6} style={{ textAlign: "center", color: C.gray400 }}>No requisitions found</TD></TR>
          ) : (
            srqs.map((s) => (
              <TR key={s.id} onClick={() => navigate(`/stores/requisitions/${s.id}`)} style={{ cursor: "pointer" }}>
                <TD><span style={{ fontWeight: 600 }}>{s.srq_number}</span></TD>
                <TD>{s.requested_by}</TD>
                <TD>{s.department ?? "—"}</TD>
                <TD>{s.purpose ?? "—"}</TD>
                <TD><Badge color={STATUS_COLORS[s.status]}>{STATUS_LABELS[s.status]}</Badge></TD>
                <TD style={{ color: C.gray500 }}>{s.created_at.slice(0, 10)}</TD>
              </TR>
            ))
          )}
        </DataTable>
      </Card>
    </div>
  );
}
