import { apiFetch } from "../../lib/apiFetch";

export interface StaffProfile {
  id: string;
  staff_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "temporary" | null;
  join_date: string | null;
  salary: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffContract {
  id: string;
  staff_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number | null;
  notes: string | null;
  created_at: string;
}

export interface StaffAttendance {
  id: string;
  staff_id: string;
  attendance_date: string;
  session: "full" | "am" | "pm";
  status: "present" | "absent" | "late" | "excused";
  notes: string | null;
  created_at: string;
}

export interface StaffAppraisal {
  id: string;
  staff_id: string;
  period: string;
  rating: number | null;
  comments: string | null;
  appraised_by: string | null;
  appraised_at: string | null;
  created_at: string;
}

export interface ListStaffParams {
  search?: string;
  department?: string;
  employment_type?: string;
  include_inactive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateStaffBody {
  staff_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  employment_type?: "full_time" | "part_time" | "contract" | "temporary";
  join_date?: string;
  salary?: number;
  notes?: string;
}

export interface UpdateStaffBody {
  staff_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  employment_type?: "full_time" | "part_time" | "contract" | "temporary";
  join_date?: string;
  salary?: number;
  is_active?: boolean;
  notes?: string;
}

export interface CreateContractBody {
  contract_type: string;
  start_date: string;
  end_date?: string;
  salary?: number;
  notes?: string;
}

export interface CreateAttendanceBody {
  attendance_date: string;
  session?: "full" | "am" | "pm";
  status?: "present" | "absent" | "late" | "excused";
  notes?: string;
}

export interface CreateAppraisalBody {
  period: string;
  rating?: number;
  comments?: string;
  appraised_by?: string;
}

export function listStaff(params?: ListStaffParams): Promise<StaffProfile[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.department) q.set("department", params.department);
  if (params?.employment_type) q.set("employment_type", params.employment_type);
  if (params?.include_inactive) q.set("include_inactive", "true");
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<StaffProfile[]>(`/staff${qs ? `?${qs}` : ""}`);
}

export function getStaff(id: string): Promise<StaffProfile> {
  return apiFetch<StaffProfile>(`/staff/${id}`);
}

export function createStaff(body: CreateStaffBody): Promise<StaffProfile> {
  return apiFetch<StaffProfile>("/staff", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateStaff(
  id: string,
  body: UpdateStaffBody,
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>(`/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteStaff(id: string): Promise<void> {
  return apiFetch<void>(`/staff/${id}`, { method: "DELETE" });
}

// ---- contracts
export function listContracts(staffId: string): Promise<StaffContract[]> {
  return apiFetch<StaffContract[]>(`/staff/${staffId}/contracts`);
}

export function createContract(
  staffId: string,
  body: CreateContractBody,
): Promise<StaffContract> {
  return apiFetch<StaffContract>(`/staff/${staffId}/contracts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- attendance
export function listAttendance(staffId: string): Promise<StaffAttendance[]> {
  return apiFetch<StaffAttendance[]>(`/staff/${staffId}/attendance`);
}

export function recordAttendance(
  staffId: string,
  body: CreateAttendanceBody,
): Promise<StaffAttendance> {
  return apiFetch<StaffAttendance>(`/staff/${staffId}/attendance`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- appraisals
export function listAppraisals(staffId: string): Promise<StaffAppraisal[]> {
  return apiFetch<StaffAppraisal[]>(`/staff/${staffId}/appraisals`);
}

export function createAppraisal(
  staffId: string,
  body: CreateAppraisalBody,
): Promise<StaffAppraisal> {
  return apiFetch<StaffAppraisal>(`/staff/${staffId}/appraisals`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
