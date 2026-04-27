import { z } from "zod";

export const PR_STATUSES = [
  "draft",
  "submitted",
  "hod_recommended",
  "principal_approved",
  "rejected",
  "ordered",
  "closed",
] as const;

export const PR_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const PO_STATUSES = [
  "draft",
  "issued",
  "partial_received",
  "received",
  "closed",
  "cancelled",
] as const;

export const GRN_STATUSES = ["draft", "confirmed"] as const;
export const GRN_CONDITIONS = ["good", "damaged", "missing"] as const;

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  contact_person: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  tin_number: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const SupplierQuerySchema = z.object({
  search: z.string().optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ---------------------------------------------------------------------------
// Purchase Requisitions
// ---------------------------------------------------------------------------
export const PRItemSchema = z.object({
  description: z.string().min(1),
  vote_item: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().default("units"),
  estimated_unit_cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const CreatePRSchema = z.object({
  pr_number: z.string().min(1),
  title: z.string().min(1),
  department: z.string().optional(),
  requested_by: z.string().optional(),
  recommended_by: z.string().optional(),
  priority: z.enum(PR_PRIORITIES).default("normal"),
  academic_year: z.string().optional(),
  required_by: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(PRItemSchema).min(1),
});

export const UpdatePRSchema = z.object({
  title: z.string().min(1).optional(),
  department: z.string().optional(),
  requested_by: z.string().optional(),
  priority: z.enum(PR_PRIORITIES).optional(),
  academic_year: z.string().optional(),
  required_by: z.string().optional(),
  notes: z.string().optional(),
});

export const PRQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(PR_STATUSES).optional(),
  department: z.string().optional(),
  academic_year: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const TransitionPRSchema = z.object({
  status: z.enum(PR_STATUSES),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------
export const POItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("units"),
  unit_price: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const CreatePOSchema = z.object({
  po_number: z.string().min(1),
  pr_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  title: z.string().min(1),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(POItemSchema).min(1),
});

export const UpdatePOSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
});

export const POQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(PO_STATUSES).optional(),
  supplier_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const TransitionPOSchema = z.object({
  status: z.enum(PO_STATUSES),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Goods Received Notes
// ---------------------------------------------------------------------------
export const GRNItemSchema = z.object({
  po_item_id: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity_ordered: z.number().nonnegative().optional(),
  quantity_received: z.number().nonnegative(),
  condition: z.enum(GRN_CONDITIONS).default("good"),
  notes: z.string().optional(),
});

export const CreateGRNSchema = z.object({
  grn_number: z.string().min(1),
  po_id: z.string().uuid().optional(),
  received_by: z.string().optional(),
  received_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(GRNItemSchema).min(1),
});

export const UpdateGRNSchema = z.object({
  received_by: z.string().optional(),
  received_date: z.string().optional(),
  notes: z.string().optional(),
});

export const GRNQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(GRN_STATUSES).optional(),
  po_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
