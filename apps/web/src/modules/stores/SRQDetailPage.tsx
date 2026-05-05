import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ensureGlobalCss, PageHeader, Card, DetailRow, Badge, DataTable, TR, TD,
  PrimaryBtn, SecondaryBtn, ErrorBanner, Field, inputCss, selectCss,
  SectionLabel, C,
} from "../../lib/ui";
import { useAuth } from "../../auth/AuthContext";
import { getSRQ, transitionSRQ, type SRQStatus } from "./stores.api";

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

export function SRQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [hodApprovedBy, setHodApprovedBy] = useState(user?.email ?? "");
  const [showApprove, setShowApprove] = useState(false);
  // Item approvals (qty + cost) editable during HOD approval
  const [itemApprovals, setItemApprovals] = useState<Record<string, { qty: string; cost: string }>>({});

  const { data: srq, isLoading } = useQuery({
    queryKey: ["srq", id],
    queryFn: () => getSRQ(id!),
    enabled: !!id,
    onSuccess: (data) => {
      const init: Record<string, { qty: string; cost: string }> = {};
      data.items.forEach((item) => {
        init[item.id] = {
          qty: String(item.quantity_approved ?? item.quantity_requested),
          cost: String(item.unit_cost ?? ""),
        };
      });
      setItemApprovals(init);
    },
  });

  const actionMut = useMutation({
    mutationFn: (vars: Parameters<typeof transitionSRQ>) => transitionSRQ(...vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["srq", id] });
      qc.invalidateQueries({ queryKey: ["srqs"] });
      setShowReject(false);
      setShowApprove(false);
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) return <div style={{ padding: 32, color: C.gray400 }}>Loading…</div>;
  if (!srq) return <div style={{ padding: 32, color: C.red }}>SRQ not found.</div>;

  const totalEstimated = srq.items.reduce(
    (sum, i) => sum + (i.quantity_requested * (i.unit_cost ?? 0)), 0
  );
  const totalApproved = srq.items.reduce(
    (sum, i) => sum + ((i.quantity_approved ?? 0) * (i.unit_cost ?? 0)), 0
  );

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        title={`SRQ: ${srq.srq_number}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {srq.status === "draft" && (
              <PrimaryBtn onClick={() => actionMut.mutate([id!, "submit"])}>
                Submit for Approval
              </PrimaryBtn>
            )}
            {srq.status === "submitted" && (
              <>
                <PrimaryBtn onClick={() => setShowApprove(true)}>HOD Approve</PrimaryBtn>
                <SecondaryBtn onClick={() => setShowReject(true)} style={{ color: C.red }}>Reject</SecondaryBtn>
              </>
            )}
            {srq.status === "hod_approved" && (
              <>
                <PrimaryBtn onClick={() => actionMut.mutate([id!, "fulfill"])}>
                  Mark Fulfilled
                </PrimaryBtn>
                <SecondaryBtn onClick={() => actionMut.mutate([id!, "escalate_to_pr"])}>
                  Escalate → PR
                </SecondaryBtn>
              </>
            )}
            <SecondaryBtn onClick={() => navigate("/stores/requisitions")}>← Back</SecondaryBtn>
          </div>
        }
      />

      {actionError && <ErrorBanner message={actionError} />}

      {/* HOD Approval Panel */}
      {showApprove && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.primary}` }}>
          <SectionLabel>HOD Approval</SectionLabel>
          <Field label="Approved By *" style={{ maxWidth: 320 }}>
            <input value={hodApprovedBy} onChange={(e) => setHodApprovedBy(e.target.value)} style={inputCss} />
          </Field>
          <div style={{ marginTop: 12 }}>
            <SectionLabel>Adjust Approved Quantities</SectionLabel>
            {srq.items.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <div style={{ fontSize: 14, color: C.gray700, paddingBottom: 6 }}>{item.description}</div>
                <Field label="Qty Approved">
                  <input
                    type="number" min={0} step="any"
                    value={itemApprovals[item.id]?.qty ?? ""}
                    onChange={(e) => setItemApprovals((p) => ({ ...p, [item.id]: { ...p[item.id], qty: e.target.value } }))}
                    style={inputCss}
                  />
                </Field>
                <Field label="Unit Cost">
                  <input
                    type="number" min={0} step="any"
                    value={itemApprovals[item.id]?.cost ?? ""}
                    onChange={(e) => setItemApprovals((p) => ({ ...p, [item.id]: { ...p[item.id], cost: e.target.value } }))}
                    style={inputCss}
                  />
                </Field>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryBtn
              onClick={() =>
                actionMut.mutate([
                  id!,
                  "hod_approve",
                  {
                    hod_approved_by: hodApprovedBy,
                    item_approvals: srq.items.map((item) => ({
                      id: item.id,
                      quantity_approved: Number(itemApprovals[item.id]?.qty ?? item.quantity_requested),
                      unit_cost: itemApprovals[item.id]?.cost ? Number(itemApprovals[item.id].cost) : undefined,
                    })),
                  },
                ])
              }
              disabled={actionMut.isPending || !hodApprovedBy}
            >
              {actionMut.isPending ? "Saving…" : "Confirm Approval"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowApprove(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Rejection Panel */}
      {showReject && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.red}` }}>
          <Field label="Reason for Rejection">
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              style={{ ...inputCss, resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <PrimaryBtn
              onClick={() => actionMut.mutate([id!, "reject", { rejection_reason: rejectionReason }])}
              disabled={actionMut.isPending}
              style={{ background: C.red }}
            >
              {actionMut.isPending ? "Saving…" : "Confirm Rejection"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowReject(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Details */}
      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          <DetailRow label="SRQ Number" value={srq.srq_number} />
          <DetailRow label="Status" value={<Badge color={STATUS_COLORS[srq.status]}>{STATUS_LABELS[srq.status]}</Badge>} />
          <DetailRow label="Requested By" value={srq.requested_by} />
          <DetailRow label="Department" value={srq.department ?? "—"} />
          <DetailRow label="Purpose" value={srq.purpose ?? "—"} />
          <DetailRow label="Required By" value={srq.required_date?.slice(0, 10) ?? "—"} />
          {srq.hod_approved_by && (
            <DetailRow label="HOD Approved By" value={`${srq.hod_approved_by} on ${srq.hod_approved_at?.slice(0, 10)}`} />
          )}
          {srq.rejection_reason && (
            <DetailRow label="Rejection Reason" value={srq.rejection_reason} />
          )}
          {srq.notes && <DetailRow label="Notes" value={srq.notes} />}
        </div>
      </Card>

      {/* Items */}
      <Card padding="0" style={{ marginBottom: 16 }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Items</SectionLabel>
          <span style={{ fontSize: 13, color: C.gray500 }}>
            Est. Total: <strong>MK {totalEstimated.toLocaleString("en-MW", { minimumFractionDigits: 2 })}</strong>
            {totalApproved > 0 && (
              <> &nbsp;|&nbsp; Approved: <strong>MK {totalApproved.toLocaleString("en-MW", { minimumFractionDigits: 2 })}</strong></>
            )}
          </span>
        </div>
        <DataTable headers={["Description", "Unit", "Qty Requested", "Qty Approved", "Unit Cost", "Line Total"]}>
          {srq.items.map((item) => (
            <TR key={item.id}>
              <TD>
                <div>{item.description}</div>
                {item.item_name && item.item_name !== item.description && (
                  <div style={{ fontSize: 11, color: C.gray400 }}>Catalog: {item.item_name}</div>
                )}
                {item.current_stock != null && (
                  <div style={{ fontSize: 11, color: item.current_stock < item.quantity_requested ? C.red : C.green }}>
                    Stock: {item.current_stock} {item.unit_of_measure}
                  </div>
                )}
              </TD>
              <TD>{item.unit}</TD>
              <TD>{item.quantity_requested}</TD>
              <TD>
                {item.quantity_approved != null ? (
                  <span style={{ color: item.quantity_approved < item.quantity_requested ? C.yellow : C.green, fontWeight: 600 }}>
                    {item.quantity_approved}
                  </span>
                ) : "—"}
              </TD>
              <TD>{item.unit_cost != null ? `MK ${Number(item.unit_cost).toFixed(2)}` : "—"}</TD>
              <TD>
                {item.quantity_approved != null && item.unit_cost != null
                  ? `MK ${(item.quantity_approved * item.unit_cost).toFixed(2)}`
                  : "—"}
              </TD>
            </TR>
          ))}
        </DataTable>
      </Card>

      {/* Linked GINs */}
      {srq.gins.length > 0 && (
        <Card padding="0">
          <div style={{ padding: "16px 20px 8px" }}>
            <SectionLabel>Linked Goods Issue Notes</SectionLabel>
          </div>
          <DataTable headers={["GIN #", "Status", "Issue Date", "Issued To"]}>
            {srq.gins.map((g) => (
              <TR key={g.id} onClick={() => navigate(`/inventory`)} style={{ cursor: "pointer" }}>
                <TD><span style={{ fontWeight: 600 }}>{g.issuance_number}</span></TD>
                <TD><Badge color={g.status === "issued" ? "green" : "gray"}>{g.status}</Badge></TD>
                <TD>{g.issue_date?.slice(0, 10)}</TD>
                <TD>{g.issued_to}</TD>
              </TR>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}
