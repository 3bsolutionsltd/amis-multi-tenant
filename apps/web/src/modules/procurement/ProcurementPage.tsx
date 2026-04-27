import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  selectCss,
} from "../../lib/ui";
import {
  listSuppliers,
  listRequisitions,
  listOrders,
  listGRNs,
  createSupplier,
  createRequisition,
  createOrder,
  createGRN,
  transitionRequisition,
  transitionOrder,
  confirmGRN,
  type Supplier,
  type PurchaseRequisition,
  type PurchaseOrder,
  type GoodsReceivedNote,
  type PRStatus,
  type POStatus,
} from "./procurement.api";

ensureGlobalCss();

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------
const PR_STATUS_COLOR: Record<string, string> = {
  draft: "gray", submitted: "blue", approved: "green", hod_recommended: "purple",
  principal_approved: "green", rejected: "red", ordered: "yellow", closed: "gray",
};
const PO_STATUS_COLOR: Record<string, string> = {
  draft: "gray", issued: "blue", partial_received: "yellow",
  received: "green", closed: "gray", cancelled: "red",
};
const GRN_STATUS_COLOR: Record<string, string> = { draft: "gray", confirmed: "green" };

const TABS = ["Requisitions", "Orders", "GRNs", "Suppliers"] as const;
type Tab = typeof TABS[number];

// ===========================================================================
// MAIN PAGE
// ===========================================================================
export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>("Requisitions");

  const tabBtn = (t: Tab): React.CSSProperties => ({
    padding: "8px 18px", border: "none", cursor: "pointer", fontWeight: tab === t ? 700 : 400,
    borderBottom: tab === t ? "3px solid #0d6efd" : "3px solid transparent",
    background: "none", color: tab === t ? "#0d6efd" : "#495057",
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader title="🛒 Procurement" subtitle="Manage requisitions, purchase orders, goods received & suppliers" />

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #dee2e6", marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Requisitions" && <RequisitionsTab />}
      {tab === "Orders" && <OrdersTab />}
      {tab === "GRNs" && <GRNsTab />}
      {tab === "Suppliers" && <SuppliersTab />}
    </div>
  );
}

// ===========================================================================
// REQUISITIONS TAB
// ===========================================================================
function RequisitionsTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PRStatus | "">("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["procurement.prs", search, status],
    queryFn: () => listRequisitions({ search: search || undefined, status: status || undefined }),
  });

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search requisitions…" />
        <select value={status} onChange={(e) => setStatus(e.target.value as PRStatus | "")} style={selectCss}>
          <option value="">All Statuses</option>
          {(["draft","submitted","approved","rejected","ordered","closed"] as PRStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <PrimaryBtn onClick={() => navigate("/procurement/requisitions/new")}>+ New Requisition</PrimaryBtn>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}

      <DataTable
        loading={isLoading}
        headers={["PR #", "Title", "Dept", "Priority", "Status", "Required By", "Created"]}
      >
        {data.map((pr) => (
          <TR key={pr.id} onClick={() => navigate(`/procurement/requisitions/${pr.id}`)}>
            <TD><code>{pr.pr_number}</code></TD>
            <TD>{pr.title}</TD>
            <TD>{pr.department ?? "—"}</TD>
            <TD>{pr.priority}</TD>
            <TD><Badge label={pr.status} color={PR_STATUS_COLOR[pr.status]} /></TD>
            <TD>{pr.required_by ?? "—"}</TD>
            <TD>{new Date(pr.created_at).toLocaleDateString()}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

// ===========================================================================
// ORDERS TAB
// ===========================================================================
function OrdersTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<POStatus | "">("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["procurement.pos", search, status],
    queryFn: () => listOrders({ search: search || undefined, status: status || undefined }),
  });

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search orders…" />
        <select value={status} onChange={(e) => setStatus(e.target.value as POStatus | "")} style={selectCss}>
          <option value="">All Statuses</option>
          {(["draft","issued","partial_received","received","closed","cancelled"] as POStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <PrimaryBtn onClick={() => navigate("/procurement/orders/new")}>+ New Order</PrimaryBtn>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}

      <DataTable
        loading={isLoading}
        headers={["PO #", "Title", "Supplier", "Status", "Total (UGX)", "Order Date", "Expected Delivery"]}
      >
        {data.map((po) => (
          <TR key={po.id} onClick={() => navigate(`/procurement/orders/${po.id}`)}>
            <TD><code>{po.po_number}</code></TD>
            <TD>{po.title}</TD>
            <TD>{po.supplier_name ?? "—"}</TD>
            <TD><Badge label={po.status} color={PO_STATUS_COLOR[po.status]} /></TD>
            <TD>{Number(po.total_amount).toLocaleString()}</TD>
            <TD>{po.order_date ?? "—"}</TD>
            <TD>{po.expected_delivery_date ?? "—"}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

// ===========================================================================
// GRNs TAB
// ===========================================================================
function GRNsTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["procurement.grns", search],
    queryFn: () => listGRNs({ search: search || undefined }),
  });

  const qc = useQueryClient();
  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmGRN(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement.grns"] }),
  });

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search GRNs…" />
        <PrimaryBtn onClick={() => navigate("/procurement/grns/new")}>+ New GRN</PrimaryBtn>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}

      <DataTable
        loading={isLoading}
        headers={["GRN #", "Received By", "Received Date", "Status", "Actions"]}
      >
        {data.map((grn) => (
          <TR key={grn.id} onClick={() => navigate(`/procurement/grns/${grn.id}`)}>
            <TD><code>{grn.grn_number}</code></TD>
            <TD>{grn.received_by ?? "—"}</TD>
            <TD>{grn.received_date ?? "—"}</TD>
            <TD><Badge label={grn.status} color={GRN_STATUS_COLOR[grn.status]} /></TD>
            <TD onClick={(e) => e.stopPropagation()}>
              {grn.status === "draft" && (
                <SecondaryBtn
                  onClick={() => confirmMut.mutate(grn.id)}
                  disabled={confirmMut.isPending}
                >
                  Confirm
                </SecondaryBtn>
              )}
            </TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

// ===========================================================================
// SUPPLIERS TAB
// ===========================================================================
function SuppliersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contact_person: "", email: "", phone: "", address: "", tin_number: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["procurement.suppliers", search],
    queryFn: () => listSuppliers({ search: search || undefined }),
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await createSupplier({
        name: form.name,
        contact_person: form.contact_person || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        tin_number: form.tin_number || undefined,
      } as Supplier);
      await qc.invalidateQueries({ queryKey: ["procurement.suppliers"] });
      setShowForm(false);
      setForm({ name: "", contact_person: "", email: "", phone: "", address: "", tin_number: "" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers…" />
        <PrimaryBtn onClick={() => setShowForm(true)}>+ Add Supplier</PrimaryBtn>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}

      {showForm && (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>New Supplier</h3>
          {formError && <ErrorBanner message={formError} />}
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Supplier Name *">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} required style={inputCss} />
              </Field>
              <Field label="Contact Person">
                <input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} style={inputCss} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={inputCss} />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputCss} />
              </Field>
              <Field label="TIN Number">
                <input value={form.tin_number} onChange={(e) => set("tin_number", e.target.value)} style={inputCss} />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={(e) => set("address", e.target.value)} style={inputCss} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Save Supplier"}</PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setShowForm(false)}>Cancel</SecondaryBtn>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        loading={isLoading}
        headers={["Name", "Contact Person", "Email", "Phone", "TIN", "Active"]}
      >
        {data.map((s) => (
          <TR key={s.id}>
            <TD><strong>{s.name}</strong></TD>
            <TD>{s.contact_person ?? "—"}</TD>
            <TD>{s.email ?? "—"}</TD>
            <TD>{s.phone ?? "—"}</TD>
            <TD>{s.tin_number ?? "—"}</TD>
            <TD>{s.is_active ? "✓" : "—"}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}
