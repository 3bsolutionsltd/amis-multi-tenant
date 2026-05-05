import { apiFetch } from "../../lib/apiFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SRQStatus =
  | "draft" | "submitted" | "hod_approved" | "fulfilled" | "rejected" | "escalated_to_pr";

export type PCVStatus =
  | "draft" | "submitted" | "hod_approved" | "bursar_approved" | "paid" | "retired" | "rejected";

export interface SRQItem {
  id: string;
  srq_id: string;
  item_id: string | null;
  item_name?: string | null;
  unit_of_measure?: string | null;
  current_stock?: number | null;
  description: string;
  quantity_requested: number;
  quantity_approved: number | null;
  unit: string;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface StoreRequisition {
  id: string;
  srq_number: string;
  requested_by: string;
  department: string | null;
  purpose: string | null;
  required_date: string | null;
  student_project_id: string | null;
  course_id: string | null;
  term_id: string | null;
  status: SRQStatus;
  hod_approved_by: string | null;
  hod_approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreRequisitionDetail extends StoreRequisition {
  items: SRQItem[];
  gins: { id: string; issuance_number: string; status: string; issue_date: string; issued_to: string }[];
}

export interface PCVItem {
  id: string;
  pcv_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes: string | null;
  created_at: string;
}

export interface PettyCashVoucher {
  id: string;
  pcv_number: string;
  requested_by: string;
  department: string | null;
  purpose: string;
  amount_requested: number;
  amount_approved: number | null;
  amount_paid: number | null;
  payment_method: string | null;
  status: PCVStatus;
  hod_approved_by: string | null;
  hod_approved_at: string | null;
  bursar_approved_by: string | null;
  bursar_approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  receipt_ref: string | null;
  receipt_date: string | null;
  retired_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PettyCashVoucherDetail extends PettyCashVoucher {
  items: PCVItem[];
}

// ---------------------------------------------------------------------------
// Store Requisitions
// ---------------------------------------------------------------------------
export function listSRQs(params?: {
  status?: string;
  department?: string;
  student_project_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<StoreRequisition[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.department) qs.set("department", params.department);
  if (params?.student_project_id) qs.set("student_project_id", params.student_project_id);
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiFetch<StoreRequisition[]>(`/stores/requisitions?${qs}`);
}

export function getSRQ(id: string): Promise<StoreRequisitionDetail> {
  return apiFetch<StoreRequisitionDetail>(`/stores/requisitions/${id}`);
}

export function createSRQ(body: {
  srq_number: string;
  requested_by: string;
  department?: string;
  purpose?: string;
  required_date?: string;
  student_project_id?: string;
  course_id?: string;
  term_id?: string;
  notes?: string;
  items: {
    item_id?: string;
    description: string;
    quantity_requested: number;
    unit: string;
    unit_cost?: number;
    notes?: string;
  }[];
}): Promise<StoreRequisition> {
  return apiFetch<StoreRequisition>("/stores/requisitions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function transitionSRQ(
  id: string,
  action: "submit" | "hod_approve" | "reject" | "escalate_to_pr" | "fulfill",
  extra?: {
    hod_approved_by?: string;
    rejection_reason?: string;
    item_approvals?: { id: string; quantity_approved: number; unit_cost?: number }[];
  }
): Promise<StoreRequisition> {
  return apiFetch<StoreRequisition>(`/stores/requisitions/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, ...extra }),
  });
}

// ---------------------------------------------------------------------------
// Petty Cash Vouchers
// ---------------------------------------------------------------------------
export function listPCVs(params?: {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PettyCashVoucher[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.department) qs.set("department", params.department);
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiFetch<PettyCashVoucher[]>(`/stores/pcv?${qs}`);
}

export function getPCV(id: string): Promise<PettyCashVoucherDetail> {
  return apiFetch<PettyCashVoucherDetail>(`/stores/pcv/${id}`);
}

export function createPCV(body: {
  pcv_number: string;
  requested_by: string;
  department?: string;
  purpose: string;
  amount_requested: number;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    notes?: string;
  }[];
}): Promise<PettyCashVoucher> {
  return apiFetch<PettyCashVoucher>("/stores/pcv", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function transitionPCV(
  id: string,
  action: "submit" | "hod_approve" | "bursar_approve" | "pay" | "retire" | "reject",
  extra?: {
    hod_approved_by?: string;
    bursar_approved_by?: string;
    amount_approved?: number;
    paid_by?: string;
    amount_paid?: number;
    payment_method?: "cash" | "mobile_money" | "bank_transfer";
    receipt_ref?: string;
    receipt_date?: string;
    rejection_reason?: string;
  }
): Promise<PettyCashVoucher> {
  return apiFetch<PettyCashVoucher>(`/stores/pcv/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, ...extra }),
  });
}
