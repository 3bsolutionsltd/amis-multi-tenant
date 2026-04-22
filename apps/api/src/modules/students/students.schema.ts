import { z } from "zod";

const GuardianFields = {
  guardian_name:         z.string().optional(),
  guardian_phone:        z.string().optional(),
  guardian_email:        z.string().email().optional(),
  guardian_relationship: z.string().optional(),
};

export const CreateStudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().date().optional(),
  admission_number: z.string().optional(),
  sponsorship_type: z.string().optional(),
  programme: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  year_of_study: z.number().int().min(1).max(6).optional(),
  class_section: z.string().optional(),
  extension: z.record(z.string(), z.unknown()).optional(),
  ...GuardianFields,
});

export type CreateStudent = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.string().date().optional(),
  admission_number: z.string().optional(),
  sponsorship_type: z.string().optional(),
  programme: z.string().optional(),
  programme_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  year_of_study: z.number().int().min(1).max(6).optional(),
  class_section: z.string().optional(),
  extension: z.record(z.string(), z.unknown()).optional(),
  ...GuardianFields,
});

export type UpdateStudent = z.infer<typeof UpdateStudentSchema>;

export const DeactivateStudentSchema = z.object({
  dropout_reason: z.string().optional(),
  dropout_date:   z.string().date().optional(),
  dropout_notes:  z.string().optional(),
});

export type DeactivateStudent = z.infer<typeof DeactivateStudentSchema>;

export const StudentsQuerySchema = z.object({
  search: z.string().optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  year_of_study: z.coerce.number().int().min(1).max(6).optional(),
  class_section: z.string().optional(),
  programme: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentsQuery = z.infer<typeof StudentsQuerySchema>;
