import { z } from "zod";

/**
 * Ordered 11-step clearance sequence (UTC Kyema / UVTAB standard).
 *
 * Each step must be SIGNED before the next can be actioned.
 * `roles` lists which AMIS roles are permitted to perform the sign-off.
 */
export const CLEARANCE_STEPS = [
  { step: 1,  dept: "academic_registrar",        label: "Academic Registrar",            roles: ["registrar", "admin"] },
  { step: 2,  dept: "accounts",                  label: "Accountant / Finance",          roles: ["finance", "admin"] },
  { step: 3,  dept: "warden",                    label: "Warden / Custodian",            roles: ["admin", "registrar"] },
  { step: 4,  dept: "store",                     label: "Stores",                        roles: ["admin", "registrar"] },
  { step: 5,  dept: "catering",                  label: "Catering Officer",              roles: ["admin", "registrar"] },
  { step: 6,  dept: "hod",                       label: "Head of Department",            roles: ["hod", "admin"] },
  { step: 7,  dept: "dean_of_students",          label: "Dean of Students",              roles: ["dean", "admin"] },
  { step: 8,  dept: "nurse",                     label: "Nurse / Health",                roles: ["admin", "registrar"] },
  { step: 9,  dept: "library",                   label: "Library",                       roles: ["admin", "registrar"] },
  { step: 10, dept: "ict_technician",            label: "ICT Technician",                roles: ["admin", "registrar"] },
  { step: 11, dept: "academic_registrar_final",  label: "Academic Registrar (Final)",    roles: ["registrar", "admin"] },
] as const;

/** Optional legacy department kept for backward-compat; not in the sequential steps */
export const OPTIONAL_DEPARTMENTS = ["sports"] as const;

export const DEPARTMENTS = CLEARANCE_STEPS.map((s) => s.dept) as unknown as [
  "academic_registrar",
  "accounts",
  "warden",
  "store",
  "catering",
  "hod",
  "dean_of_students",
  "nurse",
  "library",
  "ict_technician",
  "academic_registrar_final",
];

export type Department = typeof DEPARTMENTS[number];

/** Map dept key → step number for quick lookup */
export const DEPT_STEP: Record<string, number> = Object.fromEntries(
  CLEARANCE_STEPS.map((s) => [s.dept, s.step]),
);

/** Map dept key → display label */
export const DEPT_LABEL: Record<string, string> = Object.fromEntries(
  CLEARANCE_STEPS.map((s) => [s.dept, s.label]),
);

/** All valid department keys (sequential steps + legacy optional) */
export const ALL_VALID_DEPARTMENTS = new Set<string>([
  ...CLEARANCE_STEPS.map((s) => s.dept),
  ...OPTIONAL_DEPARTMENTS,
]);

export const SignOffSchema = z.object({
  student_id: z.string().uuid(),
  term_id: z.string().uuid(),
  department: z.string().min(1).refine(
    (d) => ALL_VALID_DEPARTMENTS.has(d),
    (d) => ({ message: `Unknown department: "${d}". Must be one of: ${[...ALL_VALID_DEPARTMENTS].join(", ")}` }),
  ),
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

