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
import { listPCVs, createPCV, type PCVStatus } from "./stores.api";

ensureGlobalCss();

const STATUS_COLORS: Record<PCVStatus, "gray" | "blue" | "yellow" | "green" | "red" | "cyan"> = {
  draft: "gray",
  submitted: "blue",
  hod_approved: "cyan",
  bursar_approved: "yellow",
  paid: "green",
  retired: "green",
  rejected: "red",
};

const STATUS_LABELS: Record<PCVStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  hod_approved: "HOD Approved",
  bursar_approved: "Bursar Approved",
  paid: "Paid",
  retired: "Retired",
  rejected: "Rejected",
};

interface PCVItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
}

const emptyItem = (): PCVItemRow => ({
  description: "", quantity: "1", unit: "units", unit_cost: "",
});

export function PCVListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { departments } = useConfig();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    pcv_number: "", requested_by: user?.email ?? "",
    department: "", purpose: "", amount_requested: "", notes: "",
  });
  const [items, setItems] = useState<PCVItemRow[]>([emptyItem()]);

  const { data: pcvs = [], isLoading } = useQuery({
    queryKey: ["pcvs", statusFilter],
    queryFn: () => listPCVs({ status: statusFilter || undefined }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPCV({
        pcv_number: form.pcv_number,
        requested_by: form.requested_by,
        department: form.department || undefined,
        purpose: form.purpose,
        amount_requested: Number(form.amount_requested),
        notes: form.notes || undefined,
        items: items.map((r) => ({
          description: r.description,
          quantity: Number(r.quantity) || 1,
          unit: r.unit,
          unit_cost: Number(r.unit_cost) || 0,
        })),
      }),
    onSuccess: (pcv) => {
      qc.invalidateQueries({ queryKey: ["pcvs"] });
      setShowForm(false);
      setForm({ pcv_number: "", requested_by: user?.email ?? "", department: "", purpose: "", amount_requested: "", notes: "" });
      setItems([emptyItem()]);
      setError(null);
      navigate(`/stores/pcv/${pcv.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  function setF(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx: number, k: keyof PCVItemRow, v: string) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  }

  // Auto-sum items into amount_requested
  function recalcTotal(newItems: PCVItemRow[]) {
    const total = newItems.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0);
    setForm((f) => ({ ...f, amount_requested: total > 0 ? String(total.toFixed(2)) : f.amount_requested }));
  }

  const statuses: Array<{ label: string; value: string }> = [
    { label: "All", value: "" },
    { label: "Draft", value: "draft" },
    { label: "Submitted", value: "submitted" },
    { label: "HOD Approved", value: "hod_approved" },
    { label: "Bursar Approved", value: "bursar_approved" },
    { label: "Paid", value: "paid" },
    { label: "Retired", value: "retired" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Petty Cash Vouchers (PCV)"
        action={
          <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New PCV"}
          </PrimaryBtn>
        }
      />

      {showForm && (
        <Card padding="20px 24px" style={{ marginBottom: 24 }}>
          <SectionLabel>New Petty Cash Voucher</SectionLabel>
          {error && <ErrorBanner message={error} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="PCV Number *">
              <input value={form.pcv_number} onChange={(e) => setF("pcv_number", e.target.value)} style={inputCss} placeholder="e.g. PCV-2026-001" required />
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
                <input value={form.department} onChange={(e) => setF("department", e.target.value)} style={inputCss} placeholder="e.g. Admin" />
              )}
            </Field>
            <Field label="Total Amount (MK) *">
              <input type="number" min={0} step="any" value={form.amount_requested} onChange={(e) => setF("amount_requested", e.target.value)} style={inputCss} placeholder="Auto-calculated from items" />
            </Field>
            <Field label="Purpose *" style={{ gridColumn: "1 / -1" }}>
              <input value={form.purpose} onChange={(e) => setF("purpose", e.target.value)} style={inputCss} required />
            </Field>
            <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
              <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
            </Field>
          </div>

          {/* Items */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <SectionLabel>Items / Breakdown</SectionLabel>
              <SecondaryBtn
                type="button"
                onClick={() => {
                  const newItems = [...items, emptyItem()];
                  setItems(newItems);
                }}
              >
                + Add Item
              </SecondaryBtn>
            </div>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
                <Field label="Description *">
                  <input value={item.description} onChange={(e) => setItem(idx, "description", e.target.value)} style={inputCss} required />
                </Field>
                <Field label="Qty">
                  <input
                    type="number" min={0.001} step="any" value={item.quantity}
                    onChange={(e) => {
                      const updated = items.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r);
                      setItems(updated);
                      recalcTotal(updated);
                    }}
                    style={inputCss}
                  />
                </Field>
                <Field label="Unit">
                  <input value={item.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} style={inputCss} />
                </Field>
                <Field label="Unit Cost (MK)">
                  <input
                    type="number" min={0} step="any" value={item.unit_cost}
                    onChange={(e) => {
                      const updated = items.map((r, i) => i === idx ? { ...r, unit_cost: e.target.value } : r);
                      setItems(updated);
                      recalcTotal(updated);
                    }}
                    style={inputCss}
                  />
                </Field>
                <div style={{ paddingBottom: 4 }}>
                  {items.length > 1 && (
                    <button type="button" onClick={() => {
                      const updated = items.filter((_, i) => i !== idx);
                      setItems(updated);
                      recalcTotal(updated);
                    }}
                      style={{ color: C.red, background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <PrimaryBtn
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.pcv_number || !form.requested_by || !form.purpose || !form.amount_requested}
            >
              {createMut.isPending ? "Saving…" : "Save PCV"}
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
        <DataTable headers={["PCV #", "Requested By", "Department", "Purpose", "Amount (MK)", "Status", "Date"]}>
          {isLoading ? (
            <TR><TD colSpan={7} style={{ textAlign: "center", color: C.gray400 }}>Loading…</TD></TR>
          ) : pcvs.length === 0 ? (
            <TR><TD colSpan={7} style={{ textAlign: "center", color: C.gray400 }}>No vouchers found</TD></TR>
          ) : (
            pcvs.map((p) => (
              <TR key={p.id} onClick={() => navigate(`/stores/pcv/${p.id}`)} style={{ cursor: "pointer" }}>
                <TD><span style={{ fontWeight: 600 }}>{p.pcv_number}</span></TD>
                <TD>{p.requested_by}</TD>
                <TD>{p.department ?? "—"}</TD>
                <TD>{p.purpose}</TD>
                <TD style={{ fontWeight: 600 }}>
                  {Number(p.amount_requested).toLocaleString("en-MW", { minimumFractionDigits: 2 })}
                </TD>
                <TD><Badge color={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge></TD>
                <TD style={{ color: C.gray500 }}>{p.created_at.slice(0, 10)}</TD>
              </TR>
            ))
          )}
        </DataTable>
      </Card>
    </div>
  );
}
