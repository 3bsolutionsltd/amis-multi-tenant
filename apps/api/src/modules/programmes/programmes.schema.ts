import { z } from "zod";

export const CreateProgrammeSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1),
  department: z.string().optional(),
  duration_months: z.number().int().positive().optional(),
  level: z.string().optional(),
});

export const UpdateProgrammeSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  title: z.string().min(1).optional(),
  department: z.string().optional(),
  duration_months: z.number().int().positive().optional(),
  level: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const ProgrammesQuerySchema = z.object({
  search: z.string().optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type CreateProgramme = z.infer<typeof CreateProgrammeSchema>;
export type UpdateProgramme = z.infer<typeof UpdateProgrammeSchema>;
export type ProgrammesQuery = z.infer<typeof ProgrammesQuerySchema>;
