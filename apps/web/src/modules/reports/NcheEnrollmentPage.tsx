import { useState } from "react";
import {
  getNcheEnrollment,
  type NcheEnrollmentRow,
  type NcheEnrollmentParams,
} from "./reports.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  C,
} from "../../lib/ui";

ensureGlobalCss();

function toCsv(rows: NcheEnrollmentRow[]): string {
  const headers = [
    "Programme",
    "Year of Study",
    "Sponsorship",
    "Total",
    "Male",
    "Female",
    "Government Sponsored",
    "Self Sponsored",
  ];
  const escape = (v: string | number | null) => {
    const s = String(v ?? "");
    return s.includes(",") ? `"${s}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.programme ?? "",
        r.year_of_study ?? "",
        r.sponsorship_type ?? "",
        r.total,
        r.male,
        r.female,
        r.government_sponsored,
        r.self_sponsored,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function NcheEnrollmentPage() {
  const [params, setParams] = useState<NcheEnrollmentParams>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    rows: NcheEnrollmentRow[];
    grand_total: number;
  } | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const r = await getNcheEnrollment(params);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function handleExportCsv() {
    if (!result) return;
    const csv = toCsv(result.rows);
    const suffix = params.academic_year ? `_${params.academic_year}` : "";
    downloadCsv(csv, `nche_enrollment${suffix}.csv`);
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: C.gray500,
    borderBottom: `1px solid ${C.gray200}`,
    background: C.gray50,
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 13,
    borderBottom: `1px solid ${C.gray100}`,
  };

  const numTd: React.CSSProperties = { ...tdStyle, textAlign: "right" };

  return (
    <div>
      <PageHeader title="NCHE / DIT Enrollment Returns" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <Field label="Academic Year">
            <input
              style={{ ...inputCss, width: 160 }}
              placeholder="e.g. 2024/2025"
              value={params.academic_year ?? ""}
              onChange={(e) =>
                setParams((p) => ({ ...p, academic_year: e.target.value || undefined }))
              }
            />
          </Field>

          <Field label="Term">
            <input
              style={{ ...inputCss, width: 120 }}
              placeholder="e.g. Term 1"
              value={params.term ?? ""}
              onChange={(e) =>
                setParams((p) => ({ ...p, term: e.target.value || undefined }))
              }
            />
          </Field>

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: loading ? C.gray200 : C.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 14,
              marginBottom: 2,
            }}
          >
            {loading ? "Loading…" : "Generate"}
          </button>

          {result && (
            <button
              onClick={handleExportCsv}
              style={{
                padding: "8px 20px",
                background: C.green,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                marginBottom: 2,
              }}
            >
              Export CSV
            </button>
          )}

          {result && (
            <button
              onClick={() => window.print()}
              style={{
                padding: "8px 20px",
                background: C.gray700,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                marginBottom: 2,
              }}
            >
              Print
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: C.redBg,
              color: C.redText,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </Card>

      {result && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Total Students", value: result.grand_total },
              {
                label: "Total Male",
                value: result.rows.reduce((s, r) => s + Number(r.male), 0),
              },
              {
                label: "Total Female",
                value: result.rows.reduce((s, r) => s + Number(r.female), 0),
              },
              {
                label: "Govt. Sponsored",
                value: result.rows.reduce(
                  (s, r) => s + Number(r.government_sponsored),
                  0,
                ),
              },
              {
                label: "Self Sponsored",
                value: result.rows.reduce(
                  (s, r) => s + Number(r.self_sponsored),
                  0,
                ),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  flex: "1 1 140px",
                  padding: "14px 20px",
                  background: C.white,
                  border: `1px solid ${C.gray200}`,
                  borderRadius: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.gray900 }}>
                  {stat.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <Card padding="0">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Programme</th>
                    <th style={thStyle}>Year</th>
                    <th style={thStyle}>Sponsorship</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Male</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Female</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Govt.</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Self</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, color: C.gray400, textAlign: "center" }}>
                        No data for selected filters
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{row.programme ?? "—"}</td>
                        <td style={tdStyle}>
                          {row.year_of_study != null ? `Year ${row.year_of_study}` : "—"}
                        </td>
                        <td style={tdStyle}>
                          {row.sponsorship_type ?? "—"}
                        </td>
                        <td style={numTd}>{Number(row.total).toLocaleString()}</td>
                        <td style={numTd}>{Number(row.male).toLocaleString()}</td>
                        <td style={numTd}>{Number(row.female).toLocaleString()}</td>
                        <td style={numTd}>{Number(row.government_sponsored).toLocaleString()}</td>
                        <td style={numTd}>{Number(row.self_sponsored).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
