import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeeCollectionReport, type FeeCollectionParams } from "./reports.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  ErrorBanner,
  inputCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

export function FeeCollectionReportPage() {
  const [filters, setFilters] = useState<FeeCollectionParams>({});
  const [applied, setApplied] = useState<FeeCollectionParams>({});

  const reportQ = useQuery({
    queryKey: ["fee-collection-report", applied],
    queryFn: () => getFeeCollectionReport(applied),
  });

  function apply() {
    setApplied({ ...filters });
  }

  function handleExportCsv() {
    const data = reportQ.data;
    if (!data) return;

    const cols = [
      "admission_number",
      "first_name",
      "last_name",
      "programme",
      "term",
      "amount",
      "payment_method",
      "payment_date",
      "reference_number",
    ];

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv =
      cols.join(",") +
      "\n" +
      data.payments
        .map((r) => cols.map((c) => escape(r[c as keyof typeof r])).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fee-collection-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const data = reportQ.data;

  return (
    <div>
      <PageHeader
        title="Fee Collection Report"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleExportCsv}
              disabled={!data}
              style={{
                padding: "8px 18px",
                background: data ? C.green : C.gray200,
                color: data ? "#fff" : C.gray500,
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: data ? "pointer" : "not-allowed",
              }}
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: "8px 18px",
                background: C.primary,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🖨 Print
            </button>
          </div>
        }
      />

      <FilterBar>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Term</div>
            <input
              style={{ ...inputCss, width: 160 }}
              placeholder="e.g. Semester 1 2026"
              value={filters.term ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value || undefined }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>From Date</div>
            <input
              type="date"
              style={{ ...inputCss, width: 160 }}
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>To Date</div>
            <input
              type="date"
              style={{ ...inputCss, width: 160 }}
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Programme</div>
            <input
              style={{ ...inputCss, width: 160 }}
              placeholder="e.g. BSCS"
              value={filters.programme ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, programme: e.target.value || undefined }))
              }
            />
          </div>

          <button
            onClick={apply}
            disabled={reportQ.isLoading}
            style={{
              padding: "8px 18px",
              background: C.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: reportQ.isLoading ? "not-allowed" : "pointer",
            }}
          >
            {reportQ.isLoading ? "Loading…" : "Generate"}
          </button>
        </div>
      </FilterBar>

      {reportQ.error && <ErrorBanner message={String(reportQ.error)} />}

      {data && (
        <>
          {/* Grand total */}
          <div
            style={{
              background: C.greenBg,
              border: `1px solid ${C.green}`,
              borderRadius: 8,
              padding: "12px 20px",
              margin: "16px 0",
              display: "inline-block",
            }}
          >
            <span style={{ fontSize: 13, color: C.greenText }}>Grand Total Collected: </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.greenText }}>
              UGX {data.grand_total.toLocaleString()}
            </span>
          </div>

          {/* Summary by programme/term */}
          {data.by_programme_term.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.gray700, marginBottom: 8 }}>
                Summary by Programme &amp; Term
              </h3>
              <DataTable columns={["Term", "Programme", "# Payments", "Total Collected (UGX)"]}>
                {data.by_programme_term.map((r, i) => (
                  <TR key={i}>
                    <TD>{r.term ?? "—"}</TD>
                    <TD>{r.programme ?? "—"}</TD>
                    <TD>{r.payment_count}</TD>
                    <TD>{r.total_collected.toLocaleString()}</TD>
                  </TR>
                ))}
              </DataTable>
            </div>
          )}

          {/* Individual payments */}
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.gray700, marginBottom: 8 }}>
            Payment Details ({data.payments.length} records)
          </h3>
          <DataTable
            columns={[
              "Adm. No.",
              "Name",
              "Programme",
              "Term",
              "Amount (UGX)",
              "Method",
              "Date",
              "Reference",
            ]}
          >
            {data.payments.map((p) => (
              <TR key={p.id}>
                <TD>{p.admission_number ?? "—"}</TD>
                <TD>
                  {p.first_name} {p.last_name}
                </TD>
                <TD>{p.programme ?? "—"}</TD>
                <TD>{p.term ?? "—"}</TD>
                <TD>{Number(p.amount).toLocaleString()}</TD>
                <TD>{p.payment_method ?? "—"}</TD>
                <TD>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</TD>
                <TD>{p.reference_number ?? "—"}</TD>
              </TR>
            ))}
          </DataTable>

          {data.payments.length === 0 && (
            <p style={{ textAlign: "center", color: C.gray400, padding: 32 }}>
              No payments found for the selected filters.
            </p>
          )}
        </>
      )}
    </div>
  );
}
