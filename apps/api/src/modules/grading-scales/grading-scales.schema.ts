import { z } from "zod";

export const CreateGradingScaleSchema = z.object({
  name: z.string().min(1),
  is_default: z.boolean().optional(),
});

export const UpdateGradingScaleSchema = z.object({
  name: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export const GradingScalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateGradeBoundarySchema = z.object({
  grade_letter: z.string().min(1).max(5),
  description: z.string().optional(),
  min_score: z.number().min(0),
  max_score: z.number().min(0),
  grade_point: z.number().min(0).optional(),
});

export const UpdateGradeBoundarySchema = z.object({
  grade_letter: z.string().min(1).max(5).optional(),
  description: z.string().optional(),
  min_score: z.number().min(0).optional(),
  max_score: z.number().min(0).optional(),
  grade_point: z.number().min(0).optional(),
});

export const BulkBoundariesSchema = z.array(CreateGradeBoundarySchema).min(1);

export type CreateGradingScale = z.infer<typeof CreateGradingScaleSchema>;
export type UpdateGradingScale = z.infer<typeof UpdateGradingScaleSchema>;
export type CreateGradeBoundary = z.infer<typeof CreateGradeBoundarySchema>;
export type UpdateGradeBoundary = z.infer<typeof UpdateGradeBoundarySchema>;
