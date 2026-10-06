import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureGlobalCss,
  PageHeader,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Card,
  DataTable,
  TR,
  TD,
} from "../../lib/ui";
import { getInventoryItem, updateInventoryItem, type InventoryCategory } from "./inventory.api";

ensureGlobalCss();

const CATEGORIES: InventoryCategory[] = [
  "stationery", "furniture", "equipment", "laboratory", "cleaning",
  "food", "uniform", "medical", "other",
];

export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory.item", id],
    queryFn: () => getInventoryItem(id!),
  });

  const updateMut = useMutation({
    mutationFn: () => updateInventoryItem(id!, {
      item_code: form.item_code,
      name: form.name,
      description: form.description,
      category: form.category as InventoryCategory,
      unit_of_measure: form.unit_of_measure,
      reorder_level: Number(form.reorder_level),
      unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
      notes: form.notes,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["inventory.item", id], (current: typeof data) => current ? { ...current, ...updated } : updated);
      setEditing(false);
    },
  });

  function beginEdit() {
    if (!data) return;
    setForm({
      item_code: data.item_code ?? "", name: data.name, description: data.description ?? "",
      category: data.category, unit_of_measure: data.unit_of_measure,
      reorder_level: String(data.reorder_level), unit_cost: data.unit_cost == null ? "" : String(data.unit_cost), notes: data.notes ?? "",
    });
    setEditing(true);
  }

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="Item not found" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/inventory")}>← Back</SecondaryBtn>
        <PageHeader title={data.name} description={`Code: ${data.item_code}`} />
        <SecondaryBtn onClick={editing ? () => setEditing(false) : beginEdit}>{editing ? "Cancel" : "Edit Item"}</SecondaryBtn>
      </div>

      {editing && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          {updateMut.isError && <ErrorBanner message={updateMut.error instanceof Error ? updateMut.error.message : "Failed to update item"} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(["item_code", "name", "unit_of_measure", "reorder_level", "unit_cost"] as const).map((key) => (
              <label key={key} style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                {key.replace(/_/g, " ").toUpperCase()}
                <input value={form[key] ?? ""} type={key === "reorder_level" || key === "unit_cost" ? "number" : "text"} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 4, fontWeight: 400 }} />
              </label>
            ))}
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>CATEGORY
              <select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 4 }}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: "grid", gap: 4, marginTop: 12, fontSize: 12, fontWeight: 600 }}>DESCRIPTION
            <textarea value={form.description ?? ""} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={2} style={{ padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 4 }} />
          </label>
          <label style={{ display: "grid", gap: 4, marginTop: 12, fontSize: 12, fontWeight: 600 }}>NOTES
            <textarea value={form.notes ?? ""} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={2} style={{ padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 4 }} />
          </label>
          <PrimaryBtn onClick={() => updateMut.mutate()} disabled={updateMut.isPending} style={{ marginTop: 12 }}>{updateMut.isPending ? "Saving…" : "Save Changes"}</PrimaryBtn>
        </Card>
      )}

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
