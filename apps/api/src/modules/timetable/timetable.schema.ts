import { z } from "zod";

export const DAY_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// HH:MM format
const timeRegex = /^\d{2}:\d{2}$/;
const TimeString = z
  .string()
  .regex(timeRegex, "Must be HH:MM format (e.g. 08:00)");

export const CreateTimetableSlotSchema = z.object({
  programme: z.string().min(1).optional(),
  academic_year: z.string().min(1).optional(),
  term_number: z.coerce.number().int().min(1).max(4).optional(),
  day_of_week: z.enum(DAY_OF_WEEK),
  start_time: TimeString,
  end_time: TimeString,
  course_id: z.string().min(1),
  room: z.string().min(1).optional(),
  instructor_name: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const UpdateTimetableSlotSchema = CreateTimetableSlotSchema.partial();

export const TimetableQuerySchema = z.object({
  programme: z.string().optional(),
  academic_year: z.string().optional(),
  term_number: z.coerce.number().int().min(1).max(4).optional(),
  day_of_week: z.enum(DAY_OF_WEEK).optional(),
});

export type CreateTimetableSlot = z.infer<typeof CreateTimetableSlotSchema>;
export type UpdateTimetableSlot = z.infer<typeof UpdateTimetableSlotSchema>;
export type TimetableQuery = z.infer<typeof TimetableQuerySchema>;
