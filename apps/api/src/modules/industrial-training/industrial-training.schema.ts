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

// --- IT Logbook Schemas ---

export const SetSupervisorPinSchema = z.object({
  pin: z
    .string()
    .min(4)
    .max(8)
    .regex(/^\d+$/, "PIN must be numeric"),
});

export const CreateLogEntrySchema = z.object({
  log_date: z.string().date(),
  task_description: z.string().min(1),
  learning_points: z.string().optional(),
});

export const UpdateLogEntrySchema = z.object({
  task_description: z.string().min(1).optional(),
  learning_points: z.string().optional().nullable(),
});

export const VerifyLogEntrySchema = z.object({
  pin: z
    .string()
    .min(4)
    .max(8)
    .regex(/^\d+$/, "PIN must be numeric"),
});

export const LogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(31),
});

export const GhostDetectionQuerySchema = z.object({
  term_id: z.string().uuid(),
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
