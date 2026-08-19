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
  assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "assessment_date must be YYYY-MM-DD").optional(),
  correction_of_submission_id: z.string().uuid().optional(),
});

export const MarkEntrySchema = z.object({
  student_id: z.string().uuid(),
  score: z.number().min(0).max(100),
});

export const PutEntriesSchema = z.object({
  entries: z.array(MarkEntrySchema).min(1),
});

// Editing a DRAFT submission's metadata (issue #296) — all fields optional,
// at least one must be provided.
export const UpdateSubmissionSchema = z
  .object({
    course_id: z.string().min(1).optional(),
    programme: z.string().min(1).optional(),
    intake: z.string().min(1).optional(),
    term: z.string().min(1).optional(),
    assessment_type: z.string().optional(),
    weight: z.number().min(0).max(100).optional(),
    assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "assessment_date must be YYYY-MM-DD").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

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
export type UpdateSubmission = z.infer<typeof UpdateSubmissionSchema>;
export type SubmissionsQuery = z.infer<typeof SubmissionsQuerySchema>;
