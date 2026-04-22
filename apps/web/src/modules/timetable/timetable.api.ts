import { apiFetch } from "../../lib/apiFetch";

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface TimetableSlot {
  id: string;
  programme: string | null;
  academic_year: string | null;
  term_number: number | null;
  day_of_week: DayOfWeek;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  course_id: string;
  room: string | null;
  instructor_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableFilters {
  programme?: string;
  academic_year?: string;
  term_number?: number;
  day_of_week?: DayOfWeek;
}

export interface TimetableSlotInput {
  programme?: string;
  academic_year?: string;
  term_number?: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  course_id: string;
  room?: string;
  instructor_name?: string;
  notes?: string;
}

export function getTimetable(filters?: TimetableFilters): Promise<TimetableSlot[]> {
  const qs = new URLSearchParams(
    Object.entries(filters ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return apiFetch(`/timetable${qs ? `?${qs}` : ""}`);
}

export function createTimetableSlot(body: TimetableSlotInput): Promise<TimetableSlot> {
  return apiFetch("/timetable", { method: "POST", body: JSON.stringify(body) });
}

export function updateTimetableSlot(
  id: string,
  body: Partial<TimetableSlotInput>,
): Promise<TimetableSlot> {
  return apiFetch(`/timetable/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteTimetableSlot(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/timetable/${id}`, { method: "DELETE" });
}
