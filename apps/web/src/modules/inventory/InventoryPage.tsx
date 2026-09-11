import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
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
} from "../../lib/ui";
import {
  listInventoryItems,
  listTransactions,
  listIssuances,
  listStockTakes,
  issueIssuance,
  getInventoryDashboard,
  listReplenishments,
  approveReplenishment,
  listInventoryAudit,
  createReplenishment,
  exportInventoryCsv,
  type InventoryCategory,
  type IssuanceStatus,
  type StockTakeStatus,
} from "./inventory.api";

ensureGlobalCss();

const CATEGORY_OPTIONS: InventoryCategory[] = [
  "stationery", "furniture", "equipment", "laboratory",
  "cleaning", "food", "uniform", "medical", "other",
];

const ISSUANCE_STATUS_COLOR: Record<IssuanceStatus, "gray" | "green"> = {
  draft: "gray", issued: "green", returned: "gray",
};

const STOCK_TAKE_STATUS_COLOR: Record<StockTakeStatus, "blue" | "green" | "purple"> = {
  in_progress: "blue", completed: "green", approved: "purple",
};

const STOCK_TAKE_STATUS_LABEL: Record<StockTakeStatus, string> = {
  in_progress: "In Progress", completed: "Completed", approved: "Approved",
};

type Tab = "dashboard" | "items" | "issuances" | "transactions" | "lowstock" | "stocktakes";

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "dashboard" || initialTab === "transactions" || initialTab === "issuances" || initialTab === "lowstock"
      ? initialTab
      : "dashboard",
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader title="Inventory & Stores" description="Manage stock, issuances and transactions" />

      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #dee2e6" }}>
        {(["dashboard", "items", "issuances", "transactions", "lowstock"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", border: "none", cursor: "pointer",
              borderBottom: tab === t ? "2px solid #0d6efd" : "2px solid transparent",
              background: "none", fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "#0d6efd" : "#495057", marginBottom: -2,
            }}
          >
            {t === "dashboard" ? "Dashboard" : t === "items" ? "Items" : t === "issuances" ? "Issuances" : t === "transactions" ? "Transactions" : "Low Stock ⚠️"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab navigate={navigate} />}
      {tab === "items" && <ItemsTab navigate={navigate} />}
      {tab === "issuances" && <IssuancesTab navigate={navigate} />}
      {tab === "transactions" && <TransactionsTab navigate={navigate} />}
      {tab === "lowstock" && <LowStockTab navigate={navigate} />}
    </div>
  );
}

function DashboardTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { user } = useAuth();
  const canApprove = user ? ["admin", "finance", "inventory_manager"].includes(user.role) : false;
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["inventory.dashboard"], queryFn: getInventoryDashboard });
  const qc = useQueryClient();
  const replenishments = useQuery({ queryKey: ["inventory.replenishments", "draft"], queryFn: () => listReplenishments("draft") });
  const audit = useQuery({ queryKey: ["inventory.audit"], queryFn: listInventoryAudit, enabled: canApprove });
  const approvalMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => approveReplenishment(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory.dashboard"] }); qc.invalidateQueries({ queryKey: ["inventory.replenishments"] }); qc.invalidateQueries({ queryKey: ["inventory.audit"] }); },
  });
  if (isLoading) return <Card style={{ padding: 32 }}>Loading dashboard...</Card>;
  if (isError || !data) return (
    <Card style={{ padding: 32 }}>
      <h3 style={{ marginTop: 0 }}>Dashboard unavailable</h3>
      <p style={{ color: "#6c757d" }}>{error instanceof Error ? error.message : "The inventory dashboard could not be loaded."}</p>
      <SecondaryBtn onClick={() => refetch()}>Retry</SecondaryBtn>
    </Card>
  );
  return (
    <div>
      <FilterBar>
        <PrimaryBtn onClick={() => navigate("/inventory?tab=lowstock")}>Review Low Stock</PrimaryBtn>
        <SecondaryBtn onClick={() => window.open(exportInventoryCsv(), "_blank")}>Export Inventory CSV</SecondaryBtn>
      </FilterBar>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          ["Active Items", data.total_items],
          ["Stock Value", `UGX ${Number(data.stock_value).toLocaleString()}`],
          ["Low Stock", data.low_stock_items],
          ["Pending Issues", data.pending_issuances],
          ["Replenishments", data.pending_replenishments],
        ].map(([label, value]) => (
          <Card key={String(label)} style={{ padding: 16 }}><div style={{ color: "#6c757d", fontSize: 12 }}>{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></Card>
        ))}
      </div>
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recent Stock Activity</h3>
        <DataTable headers={["Item", "Type", "Quantity", "Balance", "Date"]}>
          {data.recent_transactions.map((tx) => <TR key={tx.id}><TD>{tx.item_name ?? tx.item_id}</TD><TD>{tx.transaction_type}</TD><TD>{tx.quantity}</TD><TD>{tx.balance_after}</TD><TD>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "—"}</TD></TR>)}
        </DataTable>
      </Card>
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pending Replenishments</h3>
        <DataTable isLoading={replenishments.isLoading} headers={["Item", "Quantity", "Reason", "Requested By", "Actions"]}>
          {(replenishments.data ?? []).map((request) => <TR key={request.id}>
            <TD>{request.item_name ?? request.item_id}</TD><TD>{request.quantity_requested} {request.unit_of_measure ?? ""}</TD><TD>{request.reason}</TD><TD>{request.requested_by}</TD>
            <TD>{canApprove && <><PrimaryBtn onClick={() => approvalMut.mutate({ id: request.id, status: "approved" })} disabled={approvalMut.isPending} style={{ padding: "3px 10px", fontSize: 12 }}>Approve</PrimaryBtn>{" "}<SecondaryBtn onClick={() => approvalMut.mutate({ id: request.id, status: "rejected" })} disabled={approvalMut.isPending} style={{ padding: "3px 10px", fontSize: 12 }}>Reject</SecondaryBtn></>}</TD>
          </TR>)}
        </DataTable>
        {approvalMut.isError && <ErrorBanner message={String(approvalMut.error)} />}
      </Card>
      {canApprove && <Card style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Inventory Audit Trail</h3>
        <DataTable isLoading={audit.isLoading} headers={["Action", "Entity", "Details", "Date"]}>
          {(audit.data ?? []).map((entry) => <TR key={entry.id}><TD>{entry.action}</TD><TD>{entry.entity_type}</TD><TD>{JSON.stringify(entry.details)}</TD><TD>{new Date(entry.created_at).toLocaleString()}</TD></TR>)}
        </DataTable>
      </Card>}
    </div>
  );
}

function ItemsTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory.items", search, category],
    queryFn: () => listInventoryItems({ search: search || undefined, category: (category as InventoryCategory) || undefined }),
  });

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search items…" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ced4da", borderRadius: 4 }}>
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <PrimaryBtn onClick={() => navigate("/inventory/receipts/new")}>+ Receive Stock</PrimaryBtn>
        <PrimaryBtn onClick={() => navigate("/inventory/items/new")}>+ New Item</PrimaryBtn>
      </FilterBar>

      <DataTable isLoading={isLoading} headers={["Item Code", "Name", "Category", "UoM", "Current Stock", "Reorder Level", "Unit Cost (UGX)"]}>
        {data.map((item) => (
          <TR key={item.id} onClick={() => navigate(`/inventory/items/${item.id}`)} style={{ cursor: "pointer" }}>
            <TD>{item.item_code}</TD>
            <TD>{item.name}</TD>
            <TD><Badge label={item.category} color="gray" /></TD>
            <TD>{item.unit_of_measure}</TD>
            <TD>
              <span style={{ fontWeight: 700, color: item.current_stock <= item.reorder_level ? "#dc3545" : "#198754" }}>
                {item.current_stock}
              </span>
              {item.current_stock <= item.reorder_level && <span style={{ marginLeft: 6, color: "#dc3545" }}>⚠️</span>}
            </TD>
            <TD>{item.reorder_level}</TD>
            <TD>{item.unit_cost != null ? Number(item.unit_cost).toLocaleString() : "—"}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

function IssuancesTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IssuanceStatus | "">("");
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory.issuances", search, status],
    queryFn: () => listIssuances({ search: search || undefined, status: (status as IssuanceStatus) || undefined }),
  });

  const issueMut = useMutation({
    mutationFn: (id: string) => issueIssuance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory.issuances"] }),
  });

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search issuances…" />
        <select value={status} onChange={(e) => setStatus(e.target.value as IssuanceStatus | "")} style={{ padding: "6px 10px", border: "1px solid #ced4da", borderRadius: 4 }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="returned">Returned</option>
        </select>
        <PrimaryBtn onClick={() => navigate("/inventory/issuances/new")}>+ New Issuance</PrimaryBtn>
      </FilterBar>

      {issueMut.isError && <ErrorBanner message={String(issueMut.error)} />}

      <DataTable isLoading={isLoading} headers={["GIN #", "Issued To", "Department", "Req. No.", "Issued By", "Purpose", "Issue Date", "Status", "Action"]}>
        {data.map((iss) => (
          <TR key={iss.id}>
            <TD>{iss.issuance_number}</TD>
            <TD>{iss.issued_to ?? "—"}</TD>
            <TD>{(iss as any).department ?? "—"}</TD>
            <TD>{(iss as any).requisition_ref ?? "—"}</TD>
            <TD>{iss.issued_by ?? "—"}</TD>
            <TD>{iss.purpose ?? "—"}</TD>
            <TD>{iss.issue_date ?? "—"}</TD>
            <TD><Badge label={iss.status} color={ISSUANCE_STATUS_COLOR[iss.status]} /></TD>
            <TD>
              {iss.status === "draft" && (
                <PrimaryBtn onClick={() => issueMut.mutate(iss.id)} disabled={issueMut.isPending} style={{ padding: "3px 10px", fontSize: 12 }}>
                  Issue
                </PrimaryBtn>
              )}
            </TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

function TransactionsTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory.transactions"],
    queryFn: () => listTransactions(),
  });

  return (
    <div>
      <FilterBar>
        <PrimaryBtn onClick={() => navigate("/inventory/receipts/new")}>+ Record Receipt</PrimaryBtn>
        <SecondaryBtn onClick={() => navigate("/inventory/adjustments/new?type=adjustment")}>Adjust Stock</SecondaryBtn>
        <SecondaryBtn onClick={() => navigate("/inventory/returns/new?type=return")}>Record Return</SecondaryBtn>
      </FilterBar>
      <DataTable isLoading={isLoading} headers={["Item", "Type", "Quantity", "Balance After", "Reference", "Notes", "Date"]}>
        {data.map((tx) => (
          <TR key={tx.id}>
            <TD>{tx.item_name ?? tx.item_id}</TD>
            <TD>
              <Badge
                label={tx.transaction_type}
                color={["receipt", "return"].includes(tx.transaction_type) ? "green" : "red"}
              />
            </TD>
            <TD style={{ color: tx.quantity > 0 ? "#198754" : "#dc3545" }}>
              {tx.quantity > 0 ? "+" : ""}{tx.quantity}
            </TD>
            <TD>{tx.balance_after}</TD>
            <TD>{tx.reference_id ?? "—"}</TD>
            <TD>{tx.notes ?? "—"}</TD>
            <TD>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "—"}</TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

function LowStockTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [requested, setRequested] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory.items.lowstock"],
    queryFn: () => listInventoryItems({ low_stock_only: true }),
  });
  const requestMut = useMutation({
    mutationFn: (item: { id: string; name: string; reorder_level: number; current_stock: number }) => createReplenishment(item.id, {
      quantity_requested: Math.max(item.reorder_level - item.current_stock, item.reorder_level || 1),
      reason: `Below reorder level (${item.reorder_level})`,
    }),
    onSuccess: (_, item) => { setRequested(item.id); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      {requested && <Card style={{ padding: 12, marginBottom: 12, color: "#198754" }}>Replenishment request submitted.</Card>}
      {data.length === 0 && !isLoading && (
        <Card style={{ textAlign: "center", padding: 40, color: "#198754" }}>
          ✅ No items below reorder level.
        </Card>
      )}
      <DataTable isLoading={isLoading} headers={["Item Code", "Name", "Category", "Current Stock", "Reorder Level", "Deficit", "Action"]}>
        {data.map((item) => (
          <TR key={item.id} onClick={() => navigate(`/inventory/items/${item.id}`)} style={{ cursor: "pointer", background: "#fff3f3" }}>
            <TD>{item.item_code}</TD>
            <TD>{item.name}</TD>
            <TD>{item.category}</TD>
            <TD style={{ color: "#dc3545", fontWeight: 700 }}>{item.current_stock}</TD>
            <TD>{item.reorder_level}</TD>
            <TD style={{ color: "#dc3545" }}>{item.reorder_level - item.current_stock}</TD>
            <TD><SecondaryBtn onClick={(event) => { event.stopPropagation(); requestMut.mutate(item); }} disabled={requestMut.isPending} style={{ padding: "3px 10px", fontSize: 12 }}>Request Replenishment</SecondaryBtn></TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}

function StockTakesTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [financialYear, setFinancialYear] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory.stock-takes", financialYear],
    queryFn: () => listStockTakes({ financial_year: financialYear || undefined }),
  });

  return (
    <div>
      <FilterBar>
        <input
          value={financialYear}
          onChange={(e) => setFinancialYear(e.target.value)}
          placeholder="Filter by financial year…"
          style={{ padding: "6px 10px", border: "1px solid #ced4da", borderRadius: 4, fontSize: 14 }}
        />
        <PrimaryBtn onClick={() => navigate("/inventory/stock-takes/new")}>+ New Stock Take</PrimaryBtn>
      </FilterBar>

      <DataTable isLoading={isLoading} headers={["Reference", "Title", "Financial Year", "Date", "Conducted By", "Status", "Actions"]}>
        {data.map((st) => (
          <TR key={st.id}>
            <TD>{st.reference}</TD>
            <TD>{st.title ?? "—"}</TD>
            <TD>{st.financial_year ?? "—"}</TD>
            <TD>{st.take_date}</TD>
            <TD>{st.conducted_by ?? "—"}</TD>
            <TD>
              <Badge
                label={STOCK_TAKE_STATUS_LABEL[st.status]}
                color={STOCK_TAKE_STATUS_COLOR[st.status]}
              />
            </TD>
            <TD>
              <SecondaryBtn
                onClick={() => navigate(`/inventory/stock-takes/${st.id}`)}
                style={{ padding: "3px 10px", fontSize: 12 }}
              >
                View
              </SecondaryBtn>
            </TD>
          </TR>
        ))}
      </DataTable>

      {data.length === 0 && !isLoading && (
        <Card style={{ textAlign: "center", padding: 40, color: "#6c757d" }}>
          No stock takes found. Click <strong>+ New Stock Take</strong> to begin.
        </Card>
      )}
    </div>
  );
}
