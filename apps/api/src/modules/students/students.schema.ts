import { z } from "zod";

export const CreateStudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().date().optional(),
  admission_number: z.string().optional(),
  sponsorship_type: z.string().optional(),
  programme: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  extension: z.record(z.string(), z.unknown()).optional(),
});

export type CreateStudent = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.string().date().optional(),
  admission_number: z.string().optional(),
  sponsorship_type: z.string().optional(),
  programme: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  extension: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateStudent = z.infer<typeof UpdateStudentSchema>;

export const StudentsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentsQuery = z.infer<typeof StudentsQuerySchema>;
