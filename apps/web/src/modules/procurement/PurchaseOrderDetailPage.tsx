import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { getOrder, transitionOrder, type POStatus } from "./procurement.api";

ensureGlobalCss();

const STATUS_COLOR: Record<string, string> = {
  draft: "gray", issued: "blue", partial_received: "yellow",
  received: "green", closed: "gray", cancelled: "red",
};

const TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ["issued", "cancelled"],
  issued: ["partial_received", "received", "cancelled"],
  partial_received: ["received", "cancelled"],
  received: ["closed"],
  closed: [],
  cancelled: [],
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["procurement.po", id],
    queryFn: () => getOrder(id!),
  });

  const transitionMut = useMutation({
    mutationFn: (status: POStatus) => transitionOrder(id!, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement.po", id] }),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="Order not found" /></div>;

  const nextStatuses = TRANSITIONS[data.status] ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/procurement")}>← Back</SecondaryBtn>
        {data.pr_id && (
          <SecondaryBtn onClick={() => navigate(`/procurement/requisitions/${data.pr_id}`)}>
            View Source PR
          </SecondaryBtn>
        )}
        <PageHeader title={`LPO: ${data.po_number}`} subtitle={data.title} />
      </div>

      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>STATUS</label><br />
            <Badge label={data.status.replace("_", " ")} color={STATUS_COLOR[data.status]} /></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>SUPPLIER</label><br /><span>{data.supplier_name ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>TOTAL AMOUNT</label><br />
            <strong style={{ color: "#198754" }}>UGX {Number(data.total_amount).toLocaleString()}</strong></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>ORDER DATE</label><br /><span>{data.order_date ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>EXPECTED DELIVERY</label><br /><span>{data.expected_delivery_date ?? "—"}</span></div>
        </div>
        {data.notes && <p style={{ marginTop: 12, color: "#495057" }}>{data.notes}</p>}
      </Card>

      {nextStatuses.length > 0 && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <strong>Transition Status: </strong>
          {nextStatuses.map((s) => (
            <PrimaryBtn key={s} onClick={() => transitionMut.mutate(s)} disabled={transitionMut.isPending}
              style={{ marginLeft: 8 }}>
              → {s.replace("_", " ")}
            </PrimaryBtn>
          ))}
          {transitionMut.isError && <ErrorBanner message={String(transitionMut.error)} />}
        </Card>
      )}

      <Card padding="20px 24px 0">
        <h3 style={{ marginTop: 0 }}>Line Items</h3>
        <DataTable
          loading={false}
          headers={["Description", "Qty", "Unit", "Unit Price (UGX)", "Total (UGX)", "Notes"]}
        >
          {(data.items ?? []).map((item) => (
            <TR key={item.id}>
              <TD>{item.description}</TD>
              <TD>{item.quantity}</TD>
              <TD>{item.unit ?? "—"}</TD>
              <TD>{Number(item.unit_price).toLocaleString()}</TD>
              <TD>{Number(item.total_price).toLocaleString()}</TD>
              <TD>{item.notes ?? "—"}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
