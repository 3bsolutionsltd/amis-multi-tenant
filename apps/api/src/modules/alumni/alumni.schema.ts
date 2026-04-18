import { z } from "zod";

export const GraduateStudentSchema = z.object({
  graduation_date: z.string().date(),
  graduation_notes: z.string().optional(),
});

export type GraduateStudent = z.infer<typeof GraduateStudentSchema>;

export const AlumniQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AlumniQuery = z.infer<typeof AlumniQuerySchema>;
