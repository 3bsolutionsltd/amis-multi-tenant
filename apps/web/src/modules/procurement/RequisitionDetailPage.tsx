import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
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
  inputCss,
  C,
} from "../../lib/ui";
import {
  getRequisition,
  transitionRequisition,
  addPRItem,
  deletePRItem,
  getPRWorkflowDef,
  type PRStatus,
  type PRWorkflowTransition,
} from "./procurement.api";

ensureGlobalCss();

const STATUS_COLOR: Record<string, string> = {
  draft: "gray", submitted: "blue", hod_recommended: "purple",
  principal_approved: "green", rejected: "red", ordered: "yellow", closed: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", hod_recommended: "HOD Recommended",
  principal_approved: "Principal Approved", rejected: "Rejected",
  ordered: "Ordered (LPO Issued)", closed: "Closed",
};

// Human-readable labels for each workflow action
const ACTION_LABELS: Record<string, string> = {
  submit: "Submit to HOD",
  hod_recommend: "HOD Recommend",
  hod_reject: "Reject",
  principal_approve: "Principal Approve",
  principal_reject: "Reject",
  convert_to_lpo: "Convert to LPO",
  procurement_reject: "Reject",
  close: "Close",
  close_lpo: "Close",
};

// Actions that are destructive (rejection/close) — rendered in red
const DESTRUCTIVE_ACTIONS = new Set(["hod_reject", "principal_reject", "procurement_reject", "close", "close_lpo"]);

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // ── Add-item form state ──────────────────────────────────────────────────
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    description: "", vote_item: "", quantity: "", unit: "units", estimated_unit_cost: "", notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["procurement.pr", id],
    queryFn: () => getRequisition(id!),
  });

  const { data: wfDef } = useQuery({
    queryKey: ["workflowDef", "purchase_requisition"],
    queryFn: () => getPRWorkflowDef(),
  });

  const transitionMut = useMutation({
    mutationFn: (status: PRStatus) => transitionRequisition(id!, status),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["procurement.pr", id] });
      // If an LPO was auto-created, go straight to it
      if (result.po_id) {
        navigate(`/procurement/orders/${result.po_id}`);
      }
    },
  });

  const addItemMut = useMutation({
    mutationFn: () => addPRItem(id!, {
      description: newItem.description,
      vote_item: newItem.vote_item || undefined,
      quantity: Number(newItem.quantity),
      unit: newItem.unit || "units",
      estimated_unit_cost: newItem.estimated_unit_cost ? Number(newItem.estimated_unit_cost) : undefined,
      notes: newItem.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement.pr", id] });
      setNewItem({ description: "", vote_item: "", quantity: "", unit: "units", estimated_unit_cost: "", notes: "" });
      setShowAddItem(false);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => deletePRItem(id!, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement.pr", id] }),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 24 }}><ErrorBanner message="Requisition not found" /></div>;

  // Filter available actions by current status AND the logged-in user's role
  const availableActions: PRWorkflowTransition[] = wfDef
    ? wfDef.transitions.filter(
        (t) =>
          t.from === data.status &&
          (
            !t.required_role ||
            t.required_role === user?.role ||
            user?.role === "admin" ||
            user?.role === "platform_admin"
          ),
      )
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SecondaryBtn onClick={() => navigate("/procurement")}>← Back</SecondaryBtn>
        <PageHeader title={`PR: ${data.pr_number}`} subtitle={data.title} />
      </div>

      <Card padding="20px 24px" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>STATUS</label><br />
            <Badge label={STATUS_LABEL[data.status] ?? data.status} color={STATUS_COLOR[data.status]} /></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>PRIORITY</label><br /><span>{data.priority}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>DEPARTMENT</label><br /><span>{data.department ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>REQUESTED BY</label><br /><span>{data.requested_by ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>REQUIRED BY</label><br /><span>{data.required_by ?? "—"}</span></div>
          <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>ACADEMIC YEAR</label><br /><span>{data.academic_year ?? "—"}</span></div>
          {data.recommended_by && (
            <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>HOD RECOMMENDED BY</label><br />
              <span>{data.recommended_by} {data.recommended_at ? `(${data.recommended_at.slice(0,10)})` : ""}</span></div>
          )}
          {data.approved_by && (
            <div><label style={{ fontWeight: 600, fontSize: 12, color: "#6c757d" }}>PRINCIPAL APPROVED BY</label><br />
              <span>{data.approved_by} {data.approved_at ? `(${data.approved_at.slice(0,10)})` : ""}</span></div>
          )}
        </div>
        {data.notes && <p style={{ marginTop: 12, color: "#495057" }}>{data.notes}</p>}
      </Card>

      {availableActions.length > 0 && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <strong>Actions</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {availableActions.map((t) => (
              <PrimaryBtn
                key={t.action}
                onClick={() => transitionMut.mutate(t.to as PRStatus)}
                disabled={transitionMut.isPending}
                style={{
                  backgroundColor: DESTRUCTIVE_ACTIONS.has(t.action) ? "#dc3545" : undefined,
                }}
              >
                {ACTION_LABELS[t.action] ?? t.action.replace(/_/g, " ")}
              </PrimaryBtn>
            ))}
          </div>
          {transitionMut.isError && <ErrorBanner message={String(transitionMut.error)} />}
        </Card>
      )}

      {data.linked_po && (
        <Card padding="16px 24px" style={{ marginBottom: 16, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#166534" }}>LPO Created</div>
              <div style={{ fontSize: 13, color: "#15803d" }}>{data.linked_po.po_number}</div>
            </div>
            <SecondaryBtn onClick={() => navigate(`/procurement/orders/${data.linked_po!.id}`)}>
              View LPO →
            </SecondaryBtn>
          </div>
        </Card>
      )}

      {availableActions.length === 0 && wfDef && (
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>
          {data.status === "closed"
            ? "This requisition is closed."
            : "No actions available for your role at this stage."}
        </p>
      )}

      <Card padding="20px 24px 16px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          {data.status === "draft" && !showAddItem && (
            <PrimaryBtn onClick={() => setShowAddItem(true)}>+ Add Item</PrimaryBtn>
          )}
        </div>

        <DataTable
          loading={false}
          headers={["Particulars", "Vote/Item", "Qty", "Unit", "Est. Unit Cost", "Est. Total", "Notes", ...(data.status === "draft" ? [""] : [])]}
        >
          {(data.items ?? []).map((item) => (
            <TR key={item.id}>
              <TD>{item.description}</TD>
              <TD>{item.vote_item ?? "—"}</TD>
              <TD>{item.quantity}</TD>
              <TD>{item.unit ?? "—"}</TD>
              <TD>{item.estimated_unit_cost != null ? Number(item.estimated_unit_cost).toLocaleString() : "—"}</TD>
              <TD>
                {item.estimated_unit_cost != null
                  ? (item.quantity * Number(item.estimated_unit_cost)).toLocaleString()
                  : "—"}
              </TD>
              <TD>{item.notes ?? "—"}</TD>
              {data.status === "draft" && (
                <TD>
                  <button
                    onClick={() => deleteItemMut.mutate(item.id)}
                    disabled={deleteItemMut.isPending}
                    title="Remove item"
                    style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                  >
                    ✕
                  </button>
                </TD>
              )}
            </TR>
          ))}

          {/* Add-item inline form */}
          {showAddItem && (
            <TR>
              <TD>
                <input
                  style={{ ...inputCss, width: "100%", minWidth: 140 }}
                  placeholder="Description *"
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                />
              </TD>
              <TD>
                <input
                  style={{ ...inputCss, width: "100%", minWidth: 90 }}
                  placeholder="Vote/Item"
                  value={newItem.vote_item}
                  onChange={(e) => setNewItem((p) => ({ ...p, vote_item: e.target.value }))}
                />
              </TD>
              <TD>
                <input
                  type="number"
                  min={1}
                  style={{ ...inputCss, width: 70 }}
                  placeholder="Qty *"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))}
                />
              </TD>
              <TD>
                <input
                  style={{ ...inputCss, width: 70 }}
                  placeholder="units"
                  value={newItem.unit}
                  onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                />
              </TD>
              <TD>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  style={{ ...inputCss, width: 100 }}
                  placeholder="Unit cost"
                  value={newItem.estimated_unit_cost}
                  onChange={(e) => setNewItem((p) => ({ ...p, estimated_unit_cost: e.target.value }))}
                />
              </TD>
              <TD>—</TD>
              <TD>
                <input
                  style={{ ...inputCss, width: "100%", minWidth: 100 }}
                  placeholder="Notes"
                  value={newItem.notes}
                  onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))}
                />
              </TD>
              <TD>
                <div style={{ display: "flex", gap: 6 }}>
                  <PrimaryBtn
                    onClick={() => addItemMut.mutate()}
                    disabled={addItemMut.isPending || !newItem.description.trim() || !newItem.quantity}
                  >
                    Save
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => { setShowAddItem(false); setNewItem({ description: "", vote_item: "", quantity: "", unit: "units", estimated_unit_cost: "", notes: "" }); }}>
                    Cancel
                  </SecondaryBtn>
                </div>
              </TD>
            </TR>
          )}
        </DataTable>
        {addItemMut.isError && <ErrorBanner message={String(addItemMut.error)} />}
        {deleteItemMut.isError && <ErrorBanner message={String(deleteItemMut.error)} />}
      </Card>
    </div>
  );
}
