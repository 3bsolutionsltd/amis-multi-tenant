import { apiFetch } from "../../lib/apiFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type InventoryCategory =
  | "stationery" | "furniture" | "equipment" | "laboratory"
  | "cleaning" | "food" | "uniform" | "medical" | "other";

export type StockTransactionType = "receipt" | "issuance" | "adjustment" | "return";
export type IssuanceStatus = "draft" | "issued" | "returned";

export interface InventoryItem {
  id: string;
  item_code: string | null;
  name: string;
  description: string | null;
  category: InventoryCategory;
  unit_of_measure: string;
  reorder_level: number;
  current_stock: number;
  unit_cost: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  item_id: string;
  item_name?: string;
  unit_of_measure?: string;
  transaction_type: StockTransactionType;
  quantity: number;
  balance_after: number;
  reference_type: string;
  reference_id: string | null;
  performed_by: string | null;
  transaction_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface IssuanceItem {
  id: string;
  issuance_id: string;
  item_id: string;
  item_name?: string;
  unit_of_measure?: string;
  quantity_requested: number;
  quantity_issued: number;
  quantity_returned: number;
  notes: string | null;
  created_at: string;
}

export interface StoreIssuance {
  id: string;
  issuance_number: string;
  issued_to: string;
  issued_by: string | null;
  department: string | null;
  purpose: string | null;
  status: IssuanceStatus;
  issue_date: string | null;
  return_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: IssuanceItem[];
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export function listInventoryItems(params?: {
  search?: string; category?: InventoryCategory; low_stock_only?: boolean;
  include_inactive?: boolean; page?: number; limit?: number;
}): Promise<InventoryItem[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.category) q.set("category", params.category);
  if (params?.low_stock_only) q.set("low_stock_only", "true");
  if (params?.include_inactive) q.set("include_inactive", "true");
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<InventoryItem[]>(`/inventory/items${q.toString() ? `?${q}` : ""}`);
}

export function getInventoryItem(id: string): Promise<InventoryItem & { recent_transactions: StockTransaction[] }> {
  return apiFetch<InventoryItem & { recent_transactions: StockTransaction[] }>(`/inventory/items/${id}`);
}

export function createInventoryItem(body: {
  name: string; item_code?: string; description?: string; category?: InventoryCategory;
  unit_of_measure?: string; reorder_level?: number; unit_cost?: number; notes?: string;
}): Promise<InventoryItem> {
  return apiFetch<InventoryItem>("/inventory/items", { method: "POST", body: JSON.stringify(body) });
}

export function updateInventoryItem(id: string, body: Partial<{
  name: string; item_code: string; description: string; category: InventoryCategory;
  unit_of_measure: string; reorder_level: number; unit_cost: number; notes: string; is_active: boolean;
}>): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// Stock Transactions
// ---------------------------------------------------------------------------
export function listTransactions(params?: {
  item_id?: string; transaction_type?: StockTransactionType;
  from_date?: string; to_date?: string; page?: number; limit?: number;
}): Promise<StockTransaction[]> {
  const q = new URLSearchParams();
  if (params?.item_id) q.set("item_id", params.item_id);
  if (params?.transaction_type) q.set("transaction_type", params.transaction_type);
  if (params?.from_date) q.set("from_date", params.from_date);
  if (params?.to_date) q.set("to_date", params.to_date);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<StockTransaction[]>(`/inventory/transactions${q.toString() ? `?${q}` : ""}`);
}

export function createTransaction(body: {
  item_id: string; transaction_type: StockTransactionType; quantity: number;
  reference?: string; performed_by?: string; transaction_date?: string; notes?: string;
}): Promise<StockTransaction> {
  return apiFetch<StockTransaction>("/inventory/transactions", { method: "POST", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// Issuances
// ---------------------------------------------------------------------------
export function listIssuances(params?: {
  search?: string; status?: IssuanceStatus; page?: number; limit?: number;
}): Promise<StoreIssuance[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<StoreIssuance[]>(`/inventory/issuances${q.toString() ? `?${q}` : ""}`);
}

export function getIssuance(id: string): Promise<StoreIssuance & { items: IssuanceItem[] }> {
  return apiFetch<StoreIssuance & { items: IssuanceItem[] }>(`/inventory/issuances/${id}`);
}

export function createIssuance(body: {
  issuance_number: string; issued_to: string; issued_by?: string; department?: string; purpose?: string;
  issue_date?: string; notes?: string;
  items: Array<{ item_id: string; quantity_requested: number; quantity_issued?: number; notes?: string }>;
}): Promise<StoreIssuance> {
  return apiFetch<StoreIssuance>("/inventory/issuances", { method: "POST", body: JSON.stringify(body) });
}

export function issueIssuance(id: string): Promise<StoreIssuance> {
  return apiFetch<StoreIssuance>(`/inventory/issuances/${id}/issue`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Stock Takes
// ---------------------------------------------------------------------------
export type StockTakeStatus = "in_progress" | "completed" | "approved";

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  item_id: string;
  item_name?: string;
  item_code?: string | null;
  unit_of_measure?: string;
  department: string | null;
  expected_qty: number;
  counted_qty: number | null;
  condition: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockTake {
  id: string;
  reference: string;
  title: string | null;
  financial_year: string | null;
  take_date: string;
  status: StockTakeStatus;
  conducted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: StockTakeItem[];
}

export function listStockTakes(params?: {
  status?: StockTakeStatus; financial_year?: string; page?: number; limit?: number;
}): Promise<StockTake[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.financial_year) q.set("financial_year", params.financial_year);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<StockTake[]>(`/inventory/stock-takes${q.toString() ? `?${q}` : ""}`);
}

export function getStockTake(id: string): Promise<StockTake & { items: StockTakeItem[] }> {
  return apiFetch<StockTake & { items: StockTakeItem[] }>(`/inventory/stock-takes/${id}`);
}

export function createStockTake(body: {
  reference: string; title?: string; financial_year?: string; take_date?: string;
  conducted_by?: string; notes?: string;
  items?: Array<{ item_id: string; department?: string; expected_qty?: number; counted_qty?: number; condition?: string; notes?: string }>;
}): Promise<StockTake> {
  return apiFetch<StockTake>("/inventory/stock-takes", { method: "POST", body: JSON.stringify(body) });
}

export function updateStockTakeItem(stockTakeId: string, body: {
  item_id: string; department?: string; expected_qty?: number; counted_qty?: number;
  condition?: string; notes?: string;
}): Promise<StockTakeItem> {
  return apiFetch<StockTakeItem>(`/inventory/stock-takes/${stockTakeId}/items`, { method: "PUT", body: JSON.stringify(body) });
}

export function completeStockTake(id: string): Promise<StockTake> {
  return apiFetch<StockTake>(`/inventory/stock-takes/${id}/complete`, { method: "POST" });
}
