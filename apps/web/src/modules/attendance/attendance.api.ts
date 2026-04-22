import { apiFetch } from "../../lib/apiFetch";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#16a34a",
  absent: "#dc2626",
  late: "#d97706",
  excused: "#7c3aed",
};

export interface AttendanceRecord {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  course_id: string;
  programme: string;
  academic_year: string;
  term_number: number;
  date: string;
  status: AttendanceStatus;
  notes?: string | null;
  created_at: string;
}

export interface AttendanceSummary {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface AttendanceFilters {
  course_id?: string;
  student_id?: string;
  programme?: string;
  academic_year?: string;
  term_number?: number;
  date?: string;
}

export interface BatchAttendanceItem {
  student_id: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface BatchAttendanceBody {
  course_id: string;
  programme: string;
  academic_year: string;
  term_number: number;
  date: string;
  records: BatchAttendanceItem[];
}

export function getAttendance(
  filters?: AttendanceFilters
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (filters?.course_id) params.set("course_id", filters.course_id);
  if (filters?.student_id) params.set("student_id", filters.student_id);
  if (filters?.programme) params.set("programme", filters.programme);
  if (filters?.academic_year) params.set("academic_year", filters.academic_year);
  if (filters?.term_number != null)
    params.set("term_number", String(filters.term_number));
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  return apiFetch(`/attendance${qs ? `?${qs}` : ""}`);
}

export function batchSaveAttendance(
  body: BatchAttendanceBody
): Promise<{ saved: number; records: AttendanceRecord[] }> {
  return apiFetch("/attendance/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAttendanceSummary(filters?: {
  programme?: string;
  academic_year?: string;
  term_number?: number;
  course_id?: string;
  student_id?: string;
}): Promise<AttendanceSummary[]> {
  const params = new URLSearchParams();
  if (filters?.programme) params.set("programme", filters.programme);
  if (filters?.academic_year) params.set("academic_year", filters.academic_year);
  if (filters?.term_number != null)
    params.set("term_number", String(filters.term_number));
  if (filters?.course_id) params.set("course_id", filters.course_id);
  if (filters?.student_id) params.set("student_id", filters.student_id);
  const qs = params.toString();
  return apiFetch(`/attendance/summary${qs ? `?${qs}` : ""}`);
}

export function deleteAttendanceRecord(id: string): Promise<void> {
  return apiFetch(`/attendance/${id}`, { method: "DELETE" });
}
