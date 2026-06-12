import { z } from "zod";

export const VALID_TERMS = ["Term 1", "Term 2", "Term 3"] as const;
export type ValidTerm = (typeof VALID_TERMS)[number];

export const ASSESSMENT_TYPES = [
  // TVET standard types (UVTAB / UTC Kyema)
  "assignment_1",
  "assignment_2",
  "test_1",
  "test_2",
  "practical_1",
  "practical_2",
  "end_of_term",
  // Legacy / generic types
  "midterm",
  "coursework",
  "practical",
] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

/** Standard TVET weights (%) per assessment component (UVTAB grading scheme). */
export const TVET_WEIGHTS: Record<string, number> = {
  assignment_1: 5,
  assignment_2: 5,
  test_1: 10,
  test_2: 10,
  practical_1: 25,
  practical_2: 25,
  end_of_term: 40,
};

export const CreateSubmissionSchema = z.object({
  course_id: z.string().min(1),
  programme: z.string().min(1),
  intake: z.string().min(1),
  term: z.string().min(1),
  assessment_type: z.string().default("end_of_term"),
  weight: z.number().min(0).max(100).optional(),
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
  assessment_type: z.string().optional(),
  current_state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSubmission = z.infer<typeof CreateSubmissionSchema>;
export type MarkEntry = z.infer<typeof MarkEntrySchema>;
export type PutEntries = z.infer<typeof PutEntriesSchema>;
export type SubmissionsQuery = z.infer<typeof SubmissionsQuerySchema>;
