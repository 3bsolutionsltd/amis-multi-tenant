import { z } from "zod";

export const CreateTermRegistrationSchema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.string().min(1),
  term: z.string().min(1),
  extension: z.record(z.unknown()).optional(),
});

export const BulkTermRegistrationSchema = z.object({
  academic_year: z.string().min(1),
  term: z.string().min(1),
  student_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const PromoteTermRegistrationSchema = z.object({
  academic_year: z.string().min(1),
  term: z.string().min(1),
});

export const TermRegistrationsQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  academic_year: z.string().optional(),
  term: z.string().optional(),
  current_state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTermRegistration = z.infer<typeof CreateTermRegistrationSchema>;
export type BulkTermRegistration = z.infer<typeof BulkTermRegistrationSchema>;
export type PromoteTermRegistration = z.infer<typeof PromoteTermRegistrationSchema>;
export type TermRegistrationsQuery = z.infer<typeof TermRegistrationsQuerySchema>;
