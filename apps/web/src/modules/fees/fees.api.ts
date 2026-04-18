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

export interface GetFeeTransactionsResult {
  rows: Transaction[];
}

export function getFeeTransactions(
  studentId: string,
): Promise<GetFeeTransactionsResult> {
  return apiFetch<GetFeeTransactionsResult>(
    `/fees/students/${studentId}/transactions`,
  );
}

export function recordFeeEntry(body: FeeEntryBody): Promise<Transaction> {
  return apiFetch<Transaction>("/fees/entry", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface FeeImportRow {
  studentId: string;
  amount: number;
  reference: string;
  paid_at: string;
}

export interface FeeImportResult {
  inserted: number;
  errors: Array<{ row: number; message: string }>;
}

export function importFees(rows: FeeImportRow[]): Promise<FeeImportResult> {
  return apiFetch<FeeImportResult>("/fees/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

// ------------------------------------------------------------------ SchoolPay reconciliation

export interface SchoolPayTransaction {
  id: string;
  schoolpay_ref: string;
  student_name: string | null;
  student_id_match: string | null;
  payment_id_match: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  status: "unmatched" | "matched" | "disputed";
  matched_at: string | null;
  matched_by: string | null;
  created_at: string;
}

export interface ReconciliationParams {
  status?: "unmatched" | "matched" | "disputed";
  page?: number;
  limit?: number;
}

export function listReconciliation(
  params?: ReconciliationParams,
): Promise<SchoolPayTransaction[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<SchoolPayTransaction[]>(
    `/fees/reconciliation${qs ? `?${qs}` : ""}`,
  );
}

export function matchSchoolPayTransaction(
  id: string,
  studentId: string,
): Promise<{ matched: boolean; payment_id: string }> {
  return apiFetch<{ matched: boolean; payment_id: string }>(
    `/fees/reconciliation/${id}/match`,
    {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    },
  );
}
