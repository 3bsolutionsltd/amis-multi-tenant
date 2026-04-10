import { z } from "zod";

export const VALID_TERMS = ["Term 1", "Term 2", "Term 3"] as const;
export type ValidTerm = (typeof VALID_TERMS)[number];

export const CreateSubmissionSchema = z.object({
  course_id: z.string().min(1),
  programme: z.string().min(1),
  intake: z.string().min(1),
  term: z.enum(VALID_TERMS),
  correction_of_submission_id: z.string().uuid().optional(),
});

export const MarkEntrySchema = z.object({
  student_id: z.string().uuid(),
  score: z.number().min(0).max(100),
});

export const PutEntriesSchema = z.object({
  entries: z.array(MarkEntrySchema).min(1),
});

export const SubmissionsQuerySchema = z.object({
  course_id: z.string().optional(),
  programme: z.string().optional(),
  intake: z.string().optional(),
  term: z.string().optional(),
  current_state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSubmission = z.infer<typeof CreateSubmissionSchema>;
export type MarkEntry = z.infer<typeof MarkEntrySchema>;
export type PutEntries = z.infer<typeof PutEntriesSchema>;
export type SubmissionsQuery = z.infer<typeof SubmissionsQuerySchema>;
