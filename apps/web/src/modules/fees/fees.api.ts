import { apiFetch } from "../../lib/apiFetch";

export interface FeeSummary {
  totalPaid: number;
  totalDue: number;
  balance: number;
  badge: "PAID" | "PARTIAL" | "OWING";
  lastPayment: string | null;
}

export interface Transaction {
  id: string;
  student_id: string;
  amount: number;
  currency: string;
  reference: string | null;
  paid_at: string;
  source: string;
  imported_by: string | null;
  created_at: string;
}

export interface FeeEntryBody {
  student_id: string;
  amount: number;
  reference: string;
  paid_at: string;
}

export function getFeeSummary(studentId: string): Promise<FeeSummary> {
  return apiFetch<FeeSummary>(`/fees/students/${studentId}/summary`);
}

export function getFeeTransactions(studentId: string): Promise<Transaction[]> {
  return apiFetch<Transaction[]>(`/fees/students/${studentId}/transactions`);
}

export function recordFeeEntry(body: FeeEntryBody): Promise<Transaction> {
  return apiFetch<Transaction>("/fees/entry", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
