import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ensureGlobalCss,
  PageHeader,
  Badge,
  type BadgeColor,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Card,
  DataTable,
  TR,
  TD,
} from "../../lib/ui";
import { getGRN, confirmGRN } from "./procurement.api";

ensureGlobalCss();

const CONDITION_COLOR: Record<string, string> = {
  good: "green", damaged: "red", missing: "yellow",
};

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [postingSummary, setPostingSummary] = useState<{ posted: number; unmapped: number } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["procurement.grn", id],
    queryFn: () => getGRN(id!),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmGRN(id!),
    onSuccess: (result) => {
      setPostingSummary({ posted: result.inventory_posted ?? 0, unmapped: result.inventory_unmapped ?? 0 });
      qc.invalidateQueries({ queryKey: ["procurement.grn", id] });
    },
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="GRN not found" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/procurement")}>← Back</SecondaryBtn>
        <PageHeader title={`GRN: ${data.grn_number}`} />
      </div>

      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>STATUS</label><br />
            <Badge label={data.status} color={data.status === "confirmed" ? "green" : "gray"} /></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>RECEIVED BY</label><br /><span>{data.received_by ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>RECEIVED DATE</label><br /><span>{data.received_date ?? "—"}</span></div>
        </div>
        {data.notes && <p style={{ marginTop: 12, color: "#495057" }}>{data.notes}</p>}
      </Card>

      {data.status === "draft" && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <PrimaryBtn onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
            {confirmMut.isPending ? "Confirming…" : "✓ Confirm GRN"}
          </PrimaryBtn>
          {confirmMut.isError && <ErrorBanner message={String(confirmMut.error)} />}
        </Card>
      )}

      {postingSummary && (
        <Card padding="14px 18px" style={{ marginBottom: 16, borderLeft: `4px solid ${postingSummary.unmapped ? "#f59f00" : "#198754"}` }}>
          <strong>Inventory posting:</strong> {postingSummary.posted} line(s) posted.
          {postingSummary.unmapped > 0 && (
            <span style={{ marginLeft: 8, color: "#9a6700" }}>
              {postingSummary.unmapped} line(s) were not linked to inventory and need follow-up.
            </span>
          )}
        </Card>
      )}

      <Card padding="20px 24px 0">
        <h3 style={{ marginTop: 0 }}>Items Received</h3>
        <DataTable
          isLoading={false}
          headers={["Description", "Inventory Item", "Qty Ordered", "Qty Received", "Condition", "Notes"]}
        >
          {(data.items ?? []).map((item) => (
            <TR key={item.id}>
              <TD>{item.description}</TD>
              <TD>{item.inventory_item_id ? "Linked" : "Not linked"}</TD>
              <TD>{item.quantity_ordered ?? "—"}</TD>
              <TD>{item.quantity_received}</TD>
              <TD><Badge label={item.condition} color={CONDITION_COLOR[item.condition] as BadgeColor} /></TD>
              <TD>{item.notes ?? "—"}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
