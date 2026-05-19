import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ensureGlobalCss, PageHeader, Card, DetailRow, Badge, DataTable, TR, TD,
  PrimaryBtn, SecondaryBtn, ErrorBanner, Field, inputCss, selectCss,
  SectionLabel, C,
} from "../../lib/ui";
import { useAuth } from "../../auth/AuthContext";
import { getPCV, transitionPCV, type PCVStatus } from "./stores.api";

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

export function PCVDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvedBy, setApprovedBy] = useState(user?.email ?? "");
  const [amountApproved, setAmountApproved] = useState("");
  const [showHodApprove, setShowHodApprove] = useState(false);
  const [showBursarApprove, setShowBursarApprove] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showRetire, setShowRetire] = useState(false);
  const [paidBy, setPaidBy] = useState(user?.email ?? "");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "bank_transfer">("cash");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptDate, setReceiptDate] = useState("");

  const { data: pcv, isLoading } = useQuery({
    queryKey: ["pcv", id],
    queryFn: () => getPCV(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (pcv) {
      setAmountApproved(String(pcv.amount_approved ?? pcv.amount_requested));
      setAmountPaid(String(pcv.amount_approved ?? pcv.amount_requested));
    }
  }, [pcv]);

  const actionMut = useMutation({
    mutationFn: (vars: Parameters<typeof transitionPCV>) => transitionPCV(...vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pcv", id] });
      qc.invalidateQueries({ queryKey: ["pcvs"] });
      setShowReject(false); setShowHodApprove(false);
      setShowBursarApprove(false); setShowPay(false); setShowRetire(false);
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) return <div style={{ padding: 32, color: C.gray400 }}>Loading…</div>;
  if (!pcv) return <div style={{ padding: 32, color: C.red }}>PCV not found.</div>;

  const lineTotal = pcv.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0
  );

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        title={`PCV: ${pcv.pcv_number}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {pcv.status === "draft" && (
              <PrimaryBtn onClick={() => actionMut.mutate([id!, "submit"])}>Submit</PrimaryBtn>
            )}
            {pcv.status === "submitted" && (
              <>
                <PrimaryBtn onClick={() => setShowHodApprove(true)}>HOD Approve</PrimaryBtn>
                <SecondaryBtn onClick={() => setShowReject(true)} style={{ color: C.red }}>Reject</SecondaryBtn>
              </>
            )}
            {pcv.status === "hod_approved" && (
              <>
                <PrimaryBtn onClick={() => setShowBursarApprove(true)}>Bursar Approve</PrimaryBtn>
                <SecondaryBtn onClick={() => setShowReject(true)} style={{ color: C.red }}>Reject</SecondaryBtn>
              </>
            )}
            {pcv.status === "bursar_approved" && (
              <PrimaryBtn onClick={() => setShowPay(true)}>Record Payment</PrimaryBtn>
            )}
            {pcv.status === "paid" && (
              <PrimaryBtn onClick={() => setShowRetire(true)}>Retire (Attach Receipt)</PrimaryBtn>
            )}
            <SecondaryBtn onClick={() => navigate("/stores/pcv")}>← Back</SecondaryBtn>
          </div>
        }
      />

      {actionError && <ErrorBanner message={actionError} />}

      {/* HOD Approval */}
      {showHodApprove && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.primary}` }}>
          <SectionLabel>HOD Approval</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Approved By *">
              <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} style={inputCss} />
            </Field>
            <Field label="Amount Approved (MK)">
              <input type="number" min={0} step="any" value={amountApproved} onChange={(e) => setAmountApproved(e.target.value)} style={inputCss} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryBtn
              onClick={() => actionMut.mutate([id!, "hod_approve", { hod_approved_by: approvedBy, amount_approved: amountApproved ? Number(amountApproved) : undefined }])}
              disabled={actionMut.isPending || !approvedBy}
            >
              {actionMut.isPending ? "Saving…" : "Confirm"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowHodApprove(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Bursar Approval */}
      {showBursarApprove && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.primary}` }}>
          <SectionLabel>Bursar / Finance Approval</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Approved By *">
              <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} style={inputCss} />
            </Field>
            <Field label="Amount Approved (MK)">
              <input type="number" min={0} step="any" value={amountApproved} onChange={(e) => setAmountApproved(e.target.value)} style={inputCss} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryBtn
              onClick={() => actionMut.mutate([id!, "bursar_approve", { bursar_approved_by: approvedBy, amount_approved: amountApproved ? Number(amountApproved) : undefined }])}
              disabled={actionMut.isPending || !approvedBy}
            >
              {actionMut.isPending ? "Saving…" : "Confirm"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowBursarApprove(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Payment */}
      {showPay && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.primary}` }}>
          <SectionLabel>Record Payment</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Paid By *">
              <input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} style={inputCss} />
            </Field>
            <Field label="Amount Paid (MK) *">
              <input type="number" min={0} step="any" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} style={inputCss} />
            </Field>
            <Field label="Payment Method">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} style={selectCss}>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryBtn
              onClick={() => actionMut.mutate([id!, "pay", { paid_by: paidBy, amount_paid: Number(amountPaid), payment_method: paymentMethod }])}
              disabled={actionMut.isPending || !paidBy || !amountPaid}
            >
              {actionMut.isPending ? "Saving…" : "Confirm Payment"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowPay(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Retire */}
      {showRetire && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.green}` }}>
          <SectionLabel>Retire Voucher (attach receipt)</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Receipt Reference *">
              <input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} style={inputCss} placeholder="e.g. REC-001" />
            </Field>
            <Field label="Receipt Date">
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} style={inputCss} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryBtn
              onClick={() => actionMut.mutate([id!, "retire", { receipt_ref: receiptRef, receipt_date: receiptDate || undefined }])}
              disabled={actionMut.isPending || !receiptRef}
            >
              {actionMut.isPending ? "Saving…" : "Retire Voucher"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowRetire(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Rejection */}
      {showReject && (
        <Card padding="16px 20px" style={{ marginBottom: 16, borderLeft: `4px solid ${C.red}` }}>
          <Field label="Reason for Rejection">
            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} style={{ ...inputCss, resize: "vertical" }} />
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
          <DetailRow label="PCV Number">{pcv.pcv_number}</DetailRow>
          <DetailRow label="Status"><Badge color={STATUS_COLORS[pcv.status]}>{STATUS_LABELS[pcv.status]}</Badge></DetailRow>
          <DetailRow label="Requested By">{pcv.requested_by}</DetailRow>
          <DetailRow label="Department">{pcv.department ?? "—"}</DetailRow>
          <DetailRow label="Purpose">{pcv.purpose}</DetailRow>
          <DetailRow label="Amount Requested">{`MK ${Number(pcv.amount_requested).toLocaleString("en-MW", { minimumFractionDigits: 2 })}`}</DetailRow>
          {pcv.amount_approved != null && (
            <DetailRow label="Amount Approved">{`MK ${Number(pcv.amount_approved).toLocaleString("en-MW", { minimumFractionDigits: 2 })}`}</DetailRow>
          )}
          {pcv.amount_paid != null && (
            <DetailRow label="Amount Paid">{`MK ${Number(pcv.amount_paid).toLocaleString("en-MW", { minimumFractionDigits: 2 })}`}</DetailRow>
          )}
          {pcv.payment_method && <DetailRow label="Payment Method">{pcv.payment_method.replace("_", " ")}</DetailRow>}
          {pcv.paid_by && <DetailRow label="Paid By">{`${pcv.paid_by} on ${pcv.paid_at?.slice(0, 10)}`}</DetailRow>}
          {pcv.hod_approved_by && <DetailRow label="HOD Approved By">{`${pcv.hod_approved_by} on ${pcv.hod_approved_at?.slice(0, 10)}`}</DetailRow>}
          {pcv.bursar_approved_by && <DetailRow label="Bursar Approved By">{`${pcv.bursar_approved_by} on ${pcv.bursar_approved_at?.slice(0, 10)}`}</DetailRow>}
          {pcv.receipt_ref && <DetailRow label="Receipt Ref">{`${pcv.receipt_ref}${pcv.receipt_date ? ` (${pcv.receipt_date.slice(0, 10)})` : ""}`}</DetailRow>}
          {pcv.rejection_reason && <DetailRow label="Rejection Reason">{pcv.rejection_reason}</DetailRow>}
          {pcv.notes && <DetailRow label="Notes">{pcv.notes}</DetailRow>}
        </div>
      </Card>

      {/* Items */}
      <Card padding="0">
        <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Breakdown</SectionLabel>
          <span style={{ fontSize: 13, color: C.gray500 }}>
            Total: <strong>MK {lineTotal.toLocaleString("en-MW", { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>
        <DataTable headers={["Description", "Qty", "Unit", "Unit Cost (MK)", "Line Total (MK)"]}>
          {pcv.items.map((item) => (
            <TR key={item.id}>
              <TD>{item.description}</TD>
              <TD>{item.quantity}</TD>
              <TD>{item.unit}</TD>
              <TD>{Number(item.unit_cost).toFixed(2)}</TD>
              <TD style={{ fontWeight: 600 }}>
                {(Number(item.quantity) * Number(item.unit_cost)).toFixed(2)}
              </TD>
            </TR>
          ))}
          <TR style={{ background: C.gray50 }}>
            <TD colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>Grand Total</TD>
            <TD style={{ fontWeight: 700 }}>
              MK {lineTotal.toLocaleString("en-MW", { minimumFractionDigits: 2 })}
            </TD>
          </TR>
        </DataTable>
      </Card>
    </div>
  );
}
