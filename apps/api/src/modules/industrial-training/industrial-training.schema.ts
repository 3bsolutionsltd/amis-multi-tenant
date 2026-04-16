import { z } from "zod";

export const TRAINING_STATUSES = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;

export const CreateIndustrialTrainingSchema = z.object({
  student_id: z.string().uuid(),
  company: z.string().min(1),
  supervisor: z.string().optional(),
  department: z.string().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  status: z.enum(TRAINING_STATUSES).default("scheduled"),
  notes: z.string().optional(),
});

export const UpdateIndustrialTrainingSchema = z.object({
  company: z.string().min(1).optional(),
  supervisor: z.string().optional(),
  department: z.string().optional(),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  status: z.enum(TRAINING_STATUSES).optional(),
  notes: z.string().optional().nullable(),
});

export const IndustrialTrainingQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  status: z.enum(TRAINING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateIndustrialTraining = z.infer<
  typeof CreateIndustrialTrainingSchema
>;
export type UpdateIndustrialTraining = z.infer<
  typeof UpdateIndustrialTrainingSchema
>;
export type IndustrialTrainingQuery = z.infer<
  typeof IndustrialTrainingQuerySchema
>;
