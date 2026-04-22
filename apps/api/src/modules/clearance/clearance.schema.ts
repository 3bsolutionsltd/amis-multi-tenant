import { z } from "zod";

export const DEPARTMENTS = [
  "store",
  "library",
  "sports",
  "warden",
  "hod",
  "dean_of_students",
  "accounts",
  "academic_registrar",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const SignOffSchema = z.object({
  student_id: z.string().uuid(),
  term_id: z.string().uuid(),
  department: z.enum(DEPARTMENTS),
  status: z.enum(["SIGNED", "REJECTED"]),
  remarks: z.string().optional(),
});

export const ClearanceQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  term_id: z.string().uuid().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
});

export type SignOff = z.infer<typeof SignOffSchema>;
export type ClearanceQuery = z.infer<typeof ClearanceQuerySchema>;
