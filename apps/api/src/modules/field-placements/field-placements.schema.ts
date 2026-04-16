import { z } from "zod";

export const PLACEMENT_STATUSES = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;

export const PLACEMENT_TYPES = [
  "field",
  "clinical",
  "community",
  "industry",
] as const;

export const CreateFieldPlacementSchema = z.object({
  student_id: z.string().uuid(),
  host_organisation: z.string().min(1),
  supervisor: z.string().optional(),
  placement_type: z.enum(PLACEMENT_TYPES).default("field"),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  status: z.enum(PLACEMENT_STATUSES).default("scheduled"),
  notes: z.string().optional(),
});

export const UpdateFieldPlacementSchema = z.object({
  host_organisation: z.string().min(1).optional(),
  supervisor: z.string().optional().nullable(),
  placement_type: z.enum(PLACEMENT_TYPES).optional(),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  status: z.enum(PLACEMENT_STATUSES).optional(),
  notes: z.string().optional().nullable(),
});

export const FieldPlacementsQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  placement_type: z.enum(PLACEMENT_TYPES).optional(),
  status: z.enum(PLACEMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateFieldPlacement = z.infer<typeof CreateFieldPlacementSchema>;
export type UpdateFieldPlacement = z.infer<typeof UpdateFieldPlacementSchema>;
export type FieldPlacementsQuery = z.infer<typeof FieldPlacementsQuerySchema>;
