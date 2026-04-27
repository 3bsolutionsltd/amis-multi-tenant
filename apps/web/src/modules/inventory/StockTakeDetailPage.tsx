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
import { getStockTake, completeStockTake, type StockTakeStatus } from "./inventory.api";

ensureGlobalCss();

const STATUS_COLOR: Record<StockTakeStatus, string> = {
  in_progress: "blue",
  completed: "green",
  approved: "purple",
};

const STATUS_LABEL: Record<StockTakeStatus, string> = {
  in_progress: "In Progress",
  completed: "Completed",
  approved: "Approved",
};

function variance(expected: number, counted: number | null): string {
  if (counted == null) return "—";
  const v = counted - expected;
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : String(v);
}

function varianceColor(expected: number, counted: number | null): string {
  if (counted == null) return "#6c757d";
  const v = counted - expected;
  if (v < 0) return "#dc3545";
  if (v > 0) return "#fd7e14";
  return "#198754";
}

export default function StockTakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory.stock-take", id],
    queryFn: () => getStockTake(id!),
  });

  const completeMut = useMutation({
    mutationFn: () => completeStockTake(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory.stock-take", id] }),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="Stock take not found" /></div>;

  const items = data.items ?? [];
  const countedItems = items.filter((i) => i.counted_qty != null);
  const discrepancies = items.filter((i) => i.counted_qty != null && Number(i.counted_qty) !== Number(i.expected_qty));

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/inventory")}>← Back</SecondaryBtn>
        <PageHeader
          title={`Stock Take: ${data.reference}`}
          subtitle={data.title ?? undefined}
        />
      </div>

      {/* Summary header */}
      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>STATUS</label><br />
            <Badge label={STATUS_LABEL[data.status]} color={STATUS_COLOR[data.status]} />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>FINANCIAL YEAR</label><br />
            <span>{data.financial_year ?? "—"}</span>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>TAKE DATE</label><br />
            <span>{data.take_date}</span>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>CONDUCTED BY</label><br />
            <span>{data.conducted_by ?? "—"}</span>
          </div>
          {data.approved_by && (
            <div>
              <label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>APPROVED BY</label><br />
              <span>{data.approved_by}</span>
            </div>
          )}
        </div>
        {data.notes && <p style={{ marginTop: 12, color: "#495057" }}>{data.notes}</p>}
      </Card>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <Card padding="20px 24px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0d6efd" }}>{items.length}</div>
          <div style={{ fontSize: 13, color: "#6c757d" }}>Total Items</div>
        </Card>
        <Card padding="20px 24px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#198754" }}>{countedItems.length}</div>
          <div style={{ fontSize: 13, color: "#6c757d" }}>Counted</div>
        </Card>
        <Card padding="20px 24px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: discrepancies.length > 0 ? "#dc3545" : "#198754" }}>
            {discrepancies.length}
          </div>
          <div style={{ fontSize: 13, color: "#6c757d" }}>Discrepancies</div>
        </Card>
      </div>

      {/* Action buttons */}
      {data.status === "in_progress" && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <strong>Actions: </strong>
          <PrimaryBtn
            onClick={() => completeMut.mutate()}
            disabled={completeMut.isPending}
            style={{ marginLeft: 8 }}
          >
            Mark as Completed
          </PrimaryBtn>
          {completeMut.isError && <ErrorBanner message={String(completeMut.error)} />}
        </Card>
      )}

      {/* Items table */}
      <Card padding="20px 24px 0">
        <h3 style={{ marginTop: 0 }}>Item Count Details</h3>
        <DataTable
          loading={false}
          headers={["Item", "Code", "Department", "Expected Qty", "Counted Qty", "Variance", "Condition", "Notes"]}
        >
          {items.map((item) => {
            const vStr = variance(Number(item.expected_qty), item.counted_qty != null ? Number(item.counted_qty) : null);
            const vColor = varianceColor(Number(item.expected_qty), item.counted_qty != null ? Number(item.counted_qty) : null);
            return (
              <TR key={item.id}>
                <TD>{item.item_name ?? item.item_id}</TD>
                <TD>{item.item_code ?? "—"}</TD>
                <TD>{item.department ?? "—"}</TD>
                <TD>{Number(item.expected_qty).toLocaleString()}</TD>
                <TD>{item.counted_qty != null ? Number(item.counted_qty).toLocaleString() : <span style={{ color: "#6c757d" }}>Not counted</span>}</TD>
                <TD>
                  <span style={{ fontWeight: 600, color: vColor }}>{vStr}</span>
                </TD>
                <TD>{item.condition ?? "—"}</TD>
                <TD>{item.notes ?? "—"}</TD>
              </TR>
            );
          })}
        </DataTable>

        {items.length === 0 && (
          <p style={{ color: "#6c757d", textAlign: "center", padding: "20px 0" }}>
            No items recorded for this stock take yet.
          </p>
        )}
      </Card>
    </div>
  );
}
