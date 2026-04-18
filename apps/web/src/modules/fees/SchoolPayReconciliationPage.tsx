import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  listReconciliation,
  matchSchoolPayTransaction,
  type SchoolPayTransaction,
} from "./fees.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  Pagination,
} from "../../lib/ui";

export function SchoolPayReconciliationPage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const statusFilter = (params.get("status") as SchoolPayTransaction["status"]) || undefined;
  const page = Number(params.get("page") ?? "1");

  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [studentInput, setStudentInput] = useState("");

  function setPage(v: number) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("page", String(v));
      return n;
    });
  }

  function setStatusParam(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set("status", v);
      else n.delete("status");
      n.set("page", "1");
      return n;
    });
  }

  const {
    data: transactions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reconciliation", { status: statusFilter, page }],
    queryFn: () => listReconciliation({ status: statusFilter, page }),
  });

  const matchMutation = useMutation({
    mutationFn: ({ txnId, studentId }: { txnId: string; studentId: string }) =>
      matchSchoolPayTransaction(txnId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation"] });
      setMatchingId(null);
      setStudentInput("");
    },
  });

  const isEmpty = !isLoading && !error && (transactions?.length ?? 0) === 0;

  const statusColor = (s: string) =>
    s === "matched" ? "green" : s === "disputed" ? "red" : "yellow";

  return (
    <div>
      <PageHeader title="SchoolPay Reconciliation" />

      {error && (
        <div style={{ color: "#dc2626", margin: "12px 0" }}>
          Failed to load transactions.
        </div>
      )}

      <FilterBar>
        <select
          value={statusFilter ?? ""}
          onChange={(e) => setStatusParam(e.target.value)}
          style={{
            padding: "7px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            background: "white",
          }}
        >
          <option value="">All statuses</option>
          <option value="unmatched">Unmatched</option>
          <option value="matched">Matched</option>
          <option value="disputed">Disputed</option>
        </select>
      </FilterBar>

      <DataTable
        headers={["Reference", "Student", "Amount", "Paid At", "Status", ""]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="💳"
        emptyTitle="No SchoolPay transactions"
        emptyDescription="Transactions will appear here when SchoolPay sends payment notifications."
        colCount={6}
      >
        {transactions?.map((txn) => (
          <TR key={txn.id}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {txn.schoolpay_ref}
              </span>
            </TD>
            <TD muted>{txn.student_name ?? "—"}</TD>
            <TD muted>
              {txn.currency} {Number(txn.amount).toLocaleString()}
            </TD>
            <TD muted>{new Date(txn.paid_at).toLocaleDateString()}</TD>
            <TD>
              <Badge label={txn.status} color={statusColor(txn.status)} />
            </TD>
            <TD>
              {txn.status === "unmatched" && matchingId !== txn.id && (
                <button
                  onClick={() => setMatchingId(txn.id)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Match
                </button>
              )}
              {matchingId === txn.id && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    placeholder="Student ID"
                    value={studentInput}
                    onChange={(e) => setStudentInput(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      width: 220,
                    }}
                  />
                  <button
                    disabled={!studentInput || matchMutation.isPending}
                    onClick={() =>
                      matchMutation.mutate({
                        txnId: txn.id,
                        studentId: studentInput,
                      })
                    }
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      background: "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setMatchingId(null);
                      setStudentInput("");
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </TD>
          </TR>
        ))}
      </DataTable>

      <Pagination
        page={page}
        hasMore={(transactions?.length ?? 0) >= 20}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(page + 1)}
      />
    </div>
  );
}
