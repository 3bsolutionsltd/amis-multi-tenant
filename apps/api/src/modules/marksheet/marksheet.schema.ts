import { z } from "zod";

export const MARKSHEET_TEMPLATES = [
  "master",
  "uvtab",
  "instructor",
  "registrar",
  "principal",
] as const;
export type MarksheetTemplate = (typeof MARKSHEET_TEMPLATES)[number];

export const MarksheetQuerySchema = z.object({
  course_id: z.string().min(1),
  programme: z.string().optional(),
  intake: z.string().min(1),
  term: z.string().min(1),
});

export const MarksheetExportQuerySchema = MarksheetQuerySchema.extend({
  template: z.enum(MARKSHEET_TEMPLATES).default("uvtab"),
});

export type MarksheetQuery = z.infer<typeof MarksheetQuerySchema>;
export type MarksheetExportQuery = z.infer<typeof MarksheetExportQuerySchema>;
