import { z } from "zod";

export const CreateAcademicYearSchema = z.object({
  name: z.string().min(1),
  start_date: z.string().date(),
  end_date: z.string().date(),
  is_current: z.boolean().optional(),
});

export const UpdateAcademicYearSchema = z.object({
  name: z.string().min(1).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  is_current: z.boolean().optional(),
});

export const AcademicYearsQuerySchema = z.object({
  is_current: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateTermSchema = z.object({
  academic_year_id: z.string().uuid(),
  name: z.string().min(1),
  term_number: z.number().int().positive(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  is_current: z.boolean().optional(),
});

export const UpdateTermSchema = z.object({
  name: z.string().min(1).optional(),
  term_number: z.number().int().positive().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  is_current: z.boolean().optional(),
});

export const TermsQuerySchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  is_current: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAcademicYear = z.infer<typeof CreateAcademicYearSchema>;
export type UpdateAcademicYear = z.infer<typeof UpdateAcademicYearSchema>;
export type CreateTerm = z.infer<typeof CreateTermSchema>;
export type UpdateTerm = z.infer<typeof UpdateTermSchema>;
