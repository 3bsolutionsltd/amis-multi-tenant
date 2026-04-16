import { z } from "zod";

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
] as const;

export const ATTENDANCE_SESSIONS = ["full", "am", "pm"] as const;
export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
] as const;

export const CreateStaffSchema = z.object({
  staff_number: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional(),
  join_date: z.string().optional(),
  salary: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const UpdateStaffSchema = CreateStaffSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const StaffQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const CreateContractSchema = z.object({
  contract_type: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().optional(),
  salary: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const CreateAttendanceSchema = z.object({
  attendance_date: z.string().min(1),
  session: z.enum(ATTENDANCE_SESSIONS).default("full"),
  status: z.enum(ATTENDANCE_STATUSES).default("present"),
  notes: z.string().optional(),
});

export const CreateAppraisalSchema = z.object({
  period: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
  appraised_by: z.string().optional(),
});

export type CreateStaff = z.infer<typeof CreateStaffSchema>;
export type UpdateStaff = z.infer<typeof UpdateStaffSchema>;
export type StaffQuery = z.infer<typeof StaffQuerySchema>;
export type CreateContract = z.infer<typeof CreateContractSchema>;
export type CreateAttendance = z.infer<typeof CreateAttendanceSchema>;
export type CreateAppraisal = z.infer<typeof CreateAppraisalSchema>;
