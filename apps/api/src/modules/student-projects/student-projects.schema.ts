import { z } from "zod";

export const PROJECT_STATUSES = ["draft", "active", "submitted", "assessed"] as const;

export const CreateStudentProjectSchema = z.object({
  student_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  project_title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).default("draft"),
  mark_entry_id: z.string().uuid().optional(),
});

export const UpdateStudentProjectSchema = z.object({
  project_title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  term_id: z.string().uuid().optional().nullable(),
  course_id: z.string().uuid().optional().nullable(),
  mark_entry_id: z.string().uuid().optional().nullable(),
});

export const StudentProjectQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  term_id: z.string().uuid().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStudentProject = z.infer<typeof CreateStudentProjectSchema>;
export type UpdateStudentProject = z.infer<typeof UpdateStudentProjectSchema>;
export type StudentProjectQuery = z.infer<typeof StudentProjectQuerySchema>;
