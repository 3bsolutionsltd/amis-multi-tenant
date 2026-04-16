import { z } from "zod";

// ─── IT Reports (SR-F-031) ────────────────────────────────────────────────────

export const CreateITReportSchema = z.object({
  industrial_training_id: z.string().uuid(),
  report_type: z.enum(["student", "supervisor"]).default("student"),
  period: z.string().min(1),
  summary: z.string().optional(),
  challenges: z.string().optional(),
  recommendations: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  submitted_by: z.string().optional(),
  submitted_at: z.string().datetime().optional(),
});

export const ITReportQuerySchema = z.object({
  industrial_training_id: z.string().uuid().optional(),
  report_type: z.enum(["student", "supervisor"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Teacher Evaluations (SR-F-032) ──────────────────────────────────────────

export const CreateEvaluationSchema = z.object({
  student_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  academic_period: z.string().min(1),
  scores: z.record(z.number().int().min(1).max(5)).default({}),
  comments: z.string().optional(),
});

export const EvaluationQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  academic_period: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Instructor Reports (SR-F-033) ───────────────────────────────────────────

export const CreateInstructorReportSchema = z.object({
  staff_id: z.string().uuid(),
  report_type: z.enum(["weekly", "monthly"]).default("weekly"),
  period: z.string().min(1),
  content: z.string().optional(),
  due_date: z.string().optional(),
});

export const UpdateInstructorReportSchema = z.object({
  content: z.string().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  submitted_at: z.string().datetime().optional(),
});

export const InstructorReportQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  report_type: z.enum(["weekly", "monthly"]).optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
