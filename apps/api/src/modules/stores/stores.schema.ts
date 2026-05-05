import { z } from "zod";

export const SRQ_STATUSES = [
  "draft",
  "submitted",
  "hod_approved",
  "fulfilled",
  "rejected",
  "escalated_to_pr",
] as const;

export const SRQ_ITEM_COLS =
  "id, srq_id, item_id, description, quantity_requested, quantity_approved, unit, unit_cost, notes, created_at";

export const SRQ_COLS =
  "id, srq_number, requested_by, department, purpose, required_date, " +
  "student_project_id, course_id, term_id, " +
  "status, hod_approved_by, hod_approved_at, rejection_reason, notes, created_at, updated_at";

// ---------------------------------------------------------------------------
// SRQ
// ---------------------------------------------------------------------------
export const CreateSRQItemSchema = z.object({
  item_id: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity_requested: z.number().positive(),
  unit: z.string().default("units"),
  unit_cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const CreateSRQSchema = z.object({
  srq_number: z.string().min(1),
  requested_by: z.string().min(1),
  department: z.string().optional(),
  purpose: z.string().optional(),
  required_date: z.string().optional(),
  student_project_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  term_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(CreateSRQItemSchema).min(1),
});

export const UpdateSRQSchema = z.object({
  requested_by: z.string().optional(),
  department: z.string().optional(),
  purpose: z.string().optional(),
  required_date: z.string().optional(),
  student_project_id: z.string().uuid().nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
  term_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});

export const TransitionSRQSchema = z.object({
  action: z.enum([
    "submit",
    "hod_approve",
    "reject",
    "escalate_to_pr",
    "fulfill",
  ]),
  hod_approved_by: z.string().optional(),
  rejection_reason: z.string().optional(),
  // When approving, optionally set approved quantities on items
  item_approvals: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity_approved: z.number().nonnegative(),
        unit_cost: z.number().nonnegative().optional(),
      })
    )
    .optional(),
});

export const SRQQuerySchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  student_project_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// PCV
// ---------------------------------------------------------------------------
export const PCV_STATUSES = [
  "draft",
  "submitted",
  "hod_approved",
  "bursar_approved",
  "paid",
  "retired",
  "rejected",
] as const;

export const PCV_COLS =
  "id, pcv_number, requested_by, department, purpose, " +
  "amount_requested, amount_approved, amount_paid, payment_method, status, " +
  "hod_approved_by, hod_approved_at, bursar_approved_by, bursar_approved_at, " +
  "paid_by, paid_at, receipt_ref, receipt_date, retired_at, " +
  "rejection_reason, notes, created_at, updated_at";

export const PCV_ITEM_COLS =
  "id, pcv_id, description, quantity, unit, unit_cost, notes, created_at";

export const CreatePCVItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default("units"),
  unit_cost: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const CreatePCVSchema = z.object({
  pcv_number: z.string().min(1),
  requested_by: z.string().min(1),
  department: z.string().optional(),
  purpose: z.string().min(1),
  amount_requested: z.number().positive(),
  notes: z.string().optional(),
  items: z.array(CreatePCVItemSchema).min(1),
});

export const UpdatePCVSchema = z.object({
  requested_by: z.string().optional(),
  department: z.string().optional(),
  purpose: z.string().optional(),
  amount_requested: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const TransitionPCVSchema = z.object({
  action: z.enum([
    "submit",
    "hod_approve",
    "bursar_approve",
    "pay",
    "retire",
    "reject",
  ]),
  hod_approved_by: z.string().optional(),
  bursar_approved_by: z.string().optional(),
  amount_approved: z.number().positive().optional(),
  paid_by: z.string().optional(),
  amount_paid: z.number().positive().optional(),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer"]).optional(),
  receipt_ref: z.string().optional(),
  receipt_date: z.string().optional(),
  rejection_reason: z.string().optional(),
});

export const PCVQuerySchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
