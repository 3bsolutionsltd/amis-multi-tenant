import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ensureGlobalCss,
  PageHeader,
  Badge,
  SecondaryBtn,
  ErrorBanner,
  Card,
  DataTable,
  TR,
  TD,
} from "../../lib/ui";
import { getInventoryItem } from "./inventory.api";

ensureGlobalCss();

export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory.item", id],
    queryFn: () => getInventoryItem(id!),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="Item not found" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/inventory")}>← Back</SecondaryBtn>
        <PageHeader title={data.name} description={`Code: ${data.item_code}`} />
      </div>

      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>CATEGORY</label><br />
            <Badge label={data.category} color="gray" /></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>UNIT OF MEASURE</label><br /><span>{data.unit_of_measure}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>CURRENT STOCK</label><br />
            <strong style={{ fontSize: 20, color: data.current_stock <= data.reorder_level ? "#dc3545" : "#198754" }}>
              {data.current_stock} {data.unit_of_measure}
            </strong>
            {data.current_stock <= data.reorder_level && <span style={{ marginLeft: 8, color: "#dc3545" }}>⚠️ Low Stock</span>}
          </div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>REORDER LEVEL</label><br /><span>{data.reorder_level}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>UNIT COST (UGX)</label><br />
            <span>{data.unit_cost != null ? Number(data.unit_cost).toLocaleString() : "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>STOCK VALUE (UGX)</label><br />
            <strong style={{ color: "#198754" }}>
              {data.unit_cost != null ? (data.current_stock * Number(data.unit_cost)).toLocaleString() : "—"}
            </strong>
          </div>
        </div>
        {data.description && <p style={{ marginTop: 12, color: "#495057" }}>{data.description}</p>}
        {data.notes && <p style={{ color: "#6c757d", fontSize: 13 }}>{data.notes}</p>}
      </Card>

      {data.recent_transactions && data.recent_transactions.length > 0 && (
        <Card padding="20px 24px 0">
          <h3 style={{ marginTop: 0 }}>Recent Transactions (last 20)</h3>
          <DataTable isLoading={false} headers={["Type", "Quantity", "Balance After", "Reference", "Notes", "Date"]}>
            {data.recent_transactions.map((tx) => (
              <TR key={tx.id}>
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
        </Card>
      )}
    </div>
  );
}
