import { z } from "zod";

// Manual fee entry body
export const FeeEntrySchema = z.object({
  student_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1).default("ZAR"),
  reference: z.string().min(1),
  paid_at: z.string().min(1),
});

// One row in a bulk import
export const FeeImportRowSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reference: z.string().min(1),
  paid_at: z.string().min(1),
});

// Bulk import body
export const FeeImportSchema = z.object({
  rows: z.array(FeeImportRowSchema).min(1),
});

// Query params for GET transactions
export const FeeTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
