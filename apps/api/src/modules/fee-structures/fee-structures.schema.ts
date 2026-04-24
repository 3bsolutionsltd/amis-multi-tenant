import { z } from "zod";

const StudentCategorySchema = z.enum(["all", "boarding", "day"]);

export const CreateFeeStructureSchema = z.object({
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
  programme_id: z.string().uuid(),
  fee_type: z.enum(["tuition", "functional", "examination", "other"]).optional(),
  student_category: StudentCategorySchema.optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(5).optional(),
});

export const UpdateFeeStructureSchema = z.object({
  fee_type: z.enum(["tuition", "functional", "examination", "other"]).optional(),
  student_category: StudentCategorySchema.optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).max(5).optional(),
  is_active: z.boolean().optional(),
});

export const FeeStructuresQuerySchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  term_id: z.string().uuid().optional(),
  programme_id: z.string().uuid().optional(),
  fee_type: z.enum(["tuition", "functional", "examination", "other"]).optional(),
  student_category: StudentCategorySchema.optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateFeeStructure = z.infer<typeof CreateFeeStructureSchema>;
export type UpdateFeeStructure = z.infer<typeof UpdateFeeStructureSchema>;
