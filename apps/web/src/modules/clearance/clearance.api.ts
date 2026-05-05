import { apiFetch } from "../../lib/apiFetch";

export interface ClearanceStatus {
  student_id: string;
  term_id: string;
  departments: Record<
    string,
    {
      status: string;
      signed_by: string | null;
      signed_at: string | null;
      remarks: string | null;
    }
  >;
  completed: number;
  total: number;
  fully_cleared: boolean;
}

export interface EligibilityCheck {
  pass: boolean;
  detail: string;
}

export interface EligibilityResult {
  student_id: string;
  term_id: string;
  checks: {
    registered: EligibilityCheck;
    fees_cleared: EligibilityCheck;
    marks_complete: EligibilityCheck;
    attendance_ok: EligibilityCheck;
  };
  eligible: boolean;
}

export function getClearanceStatus(
  studentId: string,
  termId: string,
): Promise<ClearanceStatus> {
  return apiFetch<ClearanceStatus>(
    `/clearance/student/${studentId}/term/${termId}`,
  );
}

export function getEligibility(
  studentId: string,
  termId: string,
): Promise<EligibilityResult> {
  return apiFetch<EligibilityResult>(
    `/clearance/eligibility/${studentId}?term_id=${termId}`,
  );
}

export function signOff(body: {
  student_id: string;
  term_id: string;
  department: string;
  status: "SIGNED" | "REJECTED";
  remarks?: string;
}): Promise<unknown> {
  return apiFetch("/clearance/sign-off", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function initClearance(body: {
  student_id: string;
  term_id: string;
}): Promise<{ initialized: number }> {
  return apiFetch<{ initialized: number }>("/clearance/init", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
