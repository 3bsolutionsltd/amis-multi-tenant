import { z } from "zod";

export const CreateCourseSchema = z.object({
  programme_id: z.string().uuid(),
  code: z.string().min(1).max(20),
  title: z.string().min(1),
  credit_hours: z.number().int().positive().optional(),
  course_type: z.enum(["theory", "practical", "both"]).optional(),
  year_of_study: z.number().int().positive().optional(),
  semester: z.number().int().positive().optional(),
});

export const UpdateCourseSchema = z.object({
  programme_id: z.string().uuid().optional(),
  code: z.string().min(1).max(20).optional(),
  title: z.string().min(1).optional(),
  credit_hours: z.number().int().positive().optional(),
  course_type: z.enum(["theory", "practical", "both"]).optional(),
  year_of_study: z.number().int().positive().optional(),
  semester: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export const CoursesQuerySchema = z.object({
  programme_id: z.string().uuid().optional(),
  search: z.string().optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const CreateCourseOfferingSchema = z.object({
  course_id: z.string().uuid(),
  term_id: z.string().uuid(),
  instructor_id: z.string().uuid().optional(),
  max_enrollment: z.number().int().positive().optional(),
});

export const UpdateCourseOfferingSchema = z.object({
  instructor_id: z.string().uuid().nullable().optional(),
  max_enrollment: z.number().int().positive().nullable().optional(),
});

export const CourseOfferingsQuerySchema = z.object({
  course_id: z.string().uuid().optional(),
  term_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type CreateCourse = z.infer<typeof CreateCourseSchema>;
export type UpdateCourse = z.infer<typeof UpdateCourseSchema>;
export type CreateCourseOffering = z.infer<typeof CreateCourseOfferingSchema>;
export type UpdateCourseOffering = z.infer<typeof UpdateCourseOfferingSchema>;
