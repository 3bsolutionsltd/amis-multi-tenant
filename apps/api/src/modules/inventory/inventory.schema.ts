import { z } from "zod";

export const INVENTORY_CATEGORIES = [
  "stationery",
  "furniture",
  "equipment",
  "laboratory",
  "cleaning",
  "food",
  "uniform",
  "medical",
  "other",
] as const;

export const STOCK_TRANSACTION_TYPES = [
  "receipt",
  "issuance",
  "adjustment",
  "return",
] as const;

export const ISSUANCE_STATUSES = ["draft", "issued", "returned"] as const;

// ---------------------------------------------------------------------------
// Inventory Items
// ---------------------------------------------------------------------------
export const CreateInventoryItemSchema = z.object({
  item_code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(INVENTORY_CATEGORIES).default("other"),
  unit_of_measure: z.string().default("units"),
  reorder_level: z.number().nonnegative().default(0),
  unit_cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const InventoryItemQuerySchema = z.object({
  search: z.string().optional(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  low_stock_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ---------------------------------------------------------------------------
// Stock Transactions (manual adjustments)
// ---------------------------------------------------------------------------
export const CreateStockTransactionSchema = z.object({
  item_id: z.string().uuid(),
  transaction_type: z.enum(STOCK_TRANSACTION_TYPES),
  quantity: z.number().refine((v) => v !== 0, "Quantity must not be zero"),
  reference: z.string().optional(),
  transaction_date: z.string().optional(),
  performed_by: z.string().optional(),
  notes: z.string().optional(),
});

export const StockTransactionQuerySchema = z.object({
  item_id: z.string().uuid().optional(),
  transaction_type: z.enum(STOCK_TRANSACTION_TYPES).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ---------------------------------------------------------------------------
// Store Issuances
// ---------------------------------------------------------------------------
export const IssuanceItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity_requested: z.number().positive(),
  quantity_issued: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const CreateIssuanceSchema = z.object({
  issuance_number: z.string().min(1),
  issued_to: z.string().min(1),
  issued_by: z.string().optional(),
  department: z.string().optional(),
  requisition_ref: z.string().optional(),
  srq_id: z.string().uuid().optional(),
  purpose: z.string().optional(),
  issue_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(IssuanceItemSchema).min(1),
});

export const UpdateIssuanceSchema = z.object({
  issued_to: z.string().min(1).optional(),
  issued_by: z.string().optional(),
  purpose: z.string().optional(),
  issue_date: z.string().optional(),
  return_date: z.string().optional(),
  notes: z.string().optional(),
  student_project_id: z.string().uuid().optional().nullable(),
});

export const IssuanceQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(ISSUANCE_STATUSES).optional(),
  department: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// Stock Takes
// ---------------------------------------------------------------------------
export const STOCK_TAKE_STATUSES = ["in_progress", "completed", "approved"] as const;

export const StockTakeItemInputSchema = z.object({
  item_id: z.string().uuid(),
  department: z.string().optional(),
  expected_qty: z.number().nonnegative().default(0),
  counted_qty: z.number().nonnegative().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateStockTakeSchema = z.object({
  reference: z.string().min(1),
  title: z.string().optional(),
  financial_year: z.string().optional(),
  take_date: z.string().optional(),
  conducted_by: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(StockTakeItemInputSchema).default([]),
});

export const UpdateStockTakeSchema = z.object({
  title: z.string().optional(),
  financial_year: z.string().optional(),
  take_date: z.string().optional(),
  conducted_by: z.string().optional(),
  approved_by: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(STOCK_TAKE_STATUSES).optional(),
});

export const StockTakeQuerySchema = z.object({
  status: z.enum(STOCK_TAKE_STATUSES).optional(),
  financial_year: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const UpsertStockTakeItemSchema = z.object({
  item_id: z.string().uuid(),
  department: z.string().optional(),
  expected_qty: z.number().nonnegative().optional(),
  counted_qty: z.number().nonnegative().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
});
