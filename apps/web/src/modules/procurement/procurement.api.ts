import { apiFetch } from "../../lib/apiFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type PRStatus = "draft" | "submitted" | "hod_recommended" | "principal_approved" | "rejected" | "ordered" | "closed";
export type PRPriority = "low" | "normal" | "high" | "urgent";
export type POStatus = "draft" | "issued" | "partial_received" | "received" | "closed" | "cancelled";
export type GRNStatus = "draft" | "confirmed";
export type GRNCondition = "good" | "damaged" | "missing";

export interface PRWorkflowTransition {
  action: string;
  from: string;
  to: string;
  required_role?: string;
}

export interface PRWorkflowDef {
  key: string;
  initial_state: string;
  states: string[];
  transitions: PRWorkflowTransition[];
}

export function getPRWorkflowDef(): Promise<PRWorkflowDef> {
  return apiFetch<PRWorkflowDef>("/workflows/purchase_requisition");
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tin_number: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PRItem {
  id: string;
  pr_id: string;
  description: string;
  quantity: number;
  unit: string | null;
  estimated_unit_cost: number | null;
  vote_item?: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseRequisition {
  id: string;
  pr_number: string;
  title: string;
  department: string | null;
  requested_by: string | null;
  recommended_by: string | null;
  recommended_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  priority: PRPriority;
  status: PRStatus;
  academic_year: string | null;
  required_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: PRItem[];
  linked_po?: { id: string; po_number: string } | null;
}

export interface POItem {
  id: string;
  po_id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  pr_id: string | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  title: string;
  status: POStatus;
  order_date: string | null;
  expected_delivery_date: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: POItem[];
}

export interface GRNItem {
  id: string;
  grn_id: string;
  po_item_id: string | null;
  description: string;
  quantity_ordered: number | null;
  quantity_received: number;
  condition: GRNCondition;
  notes: string | null;
  created_at: string;
}

export interface GoodsReceivedNote {
  id: string;
  grn_number: string;
  po_id: string | null;
  received_by: string | null;
  received_date: string | null;
  status: GRNStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: GRNItem[];
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export function listSuppliers(params?: { search?: string; include_inactive?: boolean }): Promise<Supplier[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.include_inactive) q.set("include_inactive", "true");
  return apiFetch<Supplier[]>(`/procurement/suppliers${q.toString() ? `?${q}` : ""}`);
}

export function getSupplier(id: string): Promise<Supplier> {
  return apiFetch<Supplier>(`/procurement/suppliers/${id}`);
}

export function createSupplier(body: Partial<Supplier>): Promise<Supplier> {
  return apiFetch<Supplier>("/procurement/suppliers", { method: "POST", body: JSON.stringify(body) });
}

export function updateSupplier(id: string, body: Partial<Supplier>): Promise<Supplier> {
  return apiFetch<Supplier>(`/procurement/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// Purchase Requisitions
// ---------------------------------------------------------------------------
export function listRequisitions(params?: {
  search?: string; status?: PRStatus; department?: string; academic_year?: string; page?: number; limit?: number;
}): Promise<PurchaseRequisition[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.department) q.set("department", params.department);
  if (params?.academic_year) q.set("academic_year", params.academic_year);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<PurchaseRequisition[]>(`/procurement/requisitions${q.toString() ? `?${q}` : ""}`);
}

export function getRequisition(id: string): Promise<PurchaseRequisition & { items: PRItem[] }> {
  return apiFetch<PurchaseRequisition & { items: PRItem[] }>(`/procurement/requisitions/${id}`);
}

export function createRequisition(body: {
  pr_number: string; title: string; priority?: PRPriority; department?: string;
  requested_by?: string; academic_year?: string; required_by?: string; notes?: string;
  items: Array<{ description: string; quantity: number; unit?: string; estimated_unit_cost?: number; notes?: string }>;
}): Promise<PurchaseRequisition> {
  return apiFetch<PurchaseRequisition>("/procurement/requisitions", { method: "POST", body: JSON.stringify(body) });
}

export function addPRItem(prId: string, item: {
  description: string; quantity: number; unit?: string; vote_item?: string; estimated_unit_cost?: number; notes?: string;
}): Promise<PRItem> {
  return apiFetch<PRItem>(`/procurement/requisitions/${prId}/items`, { method: "POST", body: JSON.stringify(item) });
}

export function deletePRItem(prId: string, itemId: string): Promise<void> {
  return apiFetch<void>(`/procurement/requisitions/${prId}/items/${itemId}`, { method: "DELETE" });
}

export function transitionRequisition(id: string, status: PRStatus): Promise<PurchaseRequisition & { po_id?: string }> {
  return apiFetch<PurchaseRequisition & { po_id?: string }>(`/procurement/requisitions/${id}/transition`, {
    method: "POST", body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------
export function listOrders(params?: {
  search?: string; status?: POStatus; supplier_id?: string; page?: number; limit?: number;
}): Promise<PurchaseOrder[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.supplier_id) q.set("supplier_id", params.supplier_id);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<PurchaseOrder[]>(`/procurement/orders${q.toString() ? `?${q}` : ""}`);
}

export function getOrder(id: string): Promise<PurchaseOrder & { items: POItem[] }> {
  return apiFetch<PurchaseOrder & { items: POItem[] }>(`/procurement/orders/${id}`);
}

export function createOrder(body: {
  po_number: string; title: string; pr_id?: string; supplier_id?: string;
  order_date?: string; expected_delivery_date?: string; notes?: string;
  items: Array<{ description: string; quantity: number; unit?: string; unit_price: number; notes?: string }>;
}): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>("/procurement/orders", { method: "POST", body: JSON.stringify(body) });
}

export function transitionOrder(id: string, status: POStatus): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/procurement/orders/${id}/transition`, {
    method: "POST", body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Goods Received Notes
// ---------------------------------------------------------------------------
export function listGRNs(params?: {
  search?: string; status?: GRNStatus; po_id?: string; page?: number; limit?: number;
}): Promise<GoodsReceivedNote[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.po_id) q.set("po_id", params.po_id);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<GoodsReceivedNote[]>(`/procurement/grns${q.toString() ? `?${q}` : ""}`);
}

export function getGRN(id: string): Promise<GoodsReceivedNote & { items: GRNItem[] }> {
  return apiFetch<GoodsReceivedNote & { items: GRNItem[] }>(`/procurement/grns/${id}`);
}

export function createGRN(body: {
  grn_number: string; po_id?: string; received_by?: string; received_date?: string; notes?: string;
  items: Array<{
    description: string; quantity_received: number; quantity_ordered?: number;
    condition?: GRNCondition; po_item_id?: string; notes?: string;
  }>;
}): Promise<GoodsReceivedNote> {
  return apiFetch<GoodsReceivedNote>("/procurement/grns", { method: "POST", body: JSON.stringify(body) });
}

export function confirmGRN(id: string): Promise<GoodsReceivedNote> {
  return apiFetch<GoodsReceivedNote>(`/procurement/grns/${id}/confirm`, { method: "POST" });
}
