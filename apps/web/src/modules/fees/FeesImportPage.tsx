import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  importFees,
  type FeeImportRow,
  type FeeImportResult,
} from "./fees.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  DataTable,
  TR,
  TD,
  Badge,
  C,
} from "../../lib/ui";

// ---------------------------------------------------------------------------
// RFC 4180-compliant CSV parser (shared pattern with AdmissionsImportPage)
// ---------------------------------------------------------------------------
function parseCsv(text: string): Record<string, string>[] {
  function splitRow(row: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < row.length) {
      if (row[i] === '"') {
        let field = "";
        i++;
        while (i < row.length) {
          if (row[i] === '"' && i + 1 < row.length && row[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (row[i] === '"') {
            i++;
            break;
          } else {
            field += row[i++];
          }
        }
        fields.push(field.trim());
        if (i < row.length && row[i] === ",") i++;
      } else {
        const comma = row.indexOf(",", i);
        if (comma === -1) {
          fields.push(row.slice(i).trim());
          i = row.length;
        } else {
          fields.push(row.slice(i, comma).trim());
          i = comma + 1;
        }
      }
    }
    return fields;
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ---------------------------------------------------------------------------
// Client-side row validation
// ---------------------------------------------------------------------------
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

interface ValidRow {
  studentId: string;
  amount: number;
  reference: string;
  paid_at: string;
}

interface InvalidRow {
  raw: Record<string, string>;
  errors: string[];
}

function validateRows(rows: Record<string, string>[]): {
  valid: ValidRow[];
  invalid: InvalidRow[];
} {
  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];

  for (const row of rows) {
    const errs: string[] = [];

    const studentId = row["studentId"] ?? row["student_id"] ?? "";
    if (!UUID_RE.test(studentId)) errs.push("studentId must be a valid UUID");

    const rawAmount = row["amount"] ?? "";
    const amount = Number(rawAmount);
    if (!rawAmount || isNaN(amount) || amount <= 0)
      errs.push("amount must be a positive number");

    const reference = row["reference"] ?? "";
    if (!reference) errs.push("reference is required");

    const paid_at = row["paid_at"] ?? "";
    if (!DATE_RE.test(paid_at))
      errs.push("paid_at must be a date (YYYY-MM-DD)");

    if (errs.length > 0) {
      invalid.push({ raw: row, errors: errs });
    } else {
      valid.push({ studentId, amount, reference, paid_at });
    }
  }

  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function FeesImportPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parseError, setParseError] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<{
    valid: ValidRow[];
    invalid: InvalidRow[];
  } | null>(null);
  const [done, setDone] = useState<FeeImportResult | null>(null);

  const importMut = useMutation({
    mutationFn: (rows: FeeImportRow[]) => importFees(rows),
    onSuccess: (result) => {
      setDone(result);
      setPreview(null);
    },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setPreview(null);
    setDone(null);
    importMut.reset();
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setParseError("The CSV file appears empty or has only headers.");
          return;
        }
        setPreview(validateRows(rows));
      } catch {
        setParseError(
          "Failed to parse CSV. Ensure it is a valid comma-separated file.",
        );
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        title="Import Fee Payments"
        back={{ label: "Finance", to: "/finance" }}
      />

      {/* Step 1 — Upload */}
      {!preview && !done && (
        <Card padding="24px" style={{ marginBottom: 20, maxWidth: 600 }}>
          <SectionLabel>Step 1 — Upload CSV File</SectionLabel>
          <p style={{ fontSize: 14, color: C.gray500, margin: "8px 0 16px" }}>
            Required headers:{" "}
            <code
              style={{
                background: C.gray100,
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              studentId, amount, reference, paid_at
            </code>
          </p>
          <p style={{ fontSize: 13, color: C.gray400, margin: "0 0 20px" }}>
            <strong>studentId</strong> — UUID of the student &nbsp;·&nbsp;
            <strong>amount</strong> — positive number (UGX) &nbsp;·&nbsp;
            <strong>paid_at</strong> — YYYY-MM-DD
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          {parseError && <ErrorBanner message={parseError} />}
          <PrimaryBtn onClick={() => fileRef.current?.click()}>
            📂 Choose CSV File
          </PrimaryBtn>
        </Card>
      )}

      {/* Step 2 — Preview */}
      {preview && !done && (
        <>
          {/* Summary tiles */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Total rows",
                value: preview.valid.length + preview.invalid.length,
                color: C.gray500,
                border: C.gray200,
              },
              {
                label: "Valid",
                value: preview.valid.length,
                color: C.green,
                border: C.greenBg,
              },
              {
                label: "Invalid",
                value: preview.invalid.length,
                color: preview.invalid.length > 0 ? C.red : C.gray400,
                border: preview.invalid.length > 0 ? "#fca5a5" : C.gray200,
              },
            ].map(({ label, value, color, border }) => (
              <div
                key={label}
                style={{
                  background: "#fff",
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  padding: "12px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Valid rows preview */}
          {preview.valid.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <div
                style={{
                  padding: "14px 20px 10px",
                  borderBottom: `1px solid ${C.gray100}`,
                }}
              >
                <SectionLabel>
                  Step 2 — Valid Rows ({preview.valid.length})
                </SectionLabel>
              </div>
              <DataTable
                headers={["Student ID", "Amount (UGX)", "Reference", "Date"]}
                isLoading={false}
                isEmpty={false}
                colCount={4}
              >
                {preview.valid.slice(0, 50).map((row, i) => (
                  <TR key={i}>
                    <TD>
                      <code style={{ fontSize: 12 }}>
                        {row.studentId.slice(0, 8)}…
                      </code>
                    </TD>
                    <TD>
                      <span style={{ fontWeight: 600 }}>
                        {row.amount.toLocaleString()}
                      </span>
                    </TD>
                    <TD>{row.reference}</TD>
                    <TD muted>{row.paid_at.slice(0, 10)}</TD>
                  </TR>
                ))}
              </DataTable>
              {preview.valid.length > 50 && (
                <div
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    color: C.gray400,
                    borderTop: `1px solid ${C.gray100}`,
                  }}
                >
                  … and {preview.valid.length - 50} more rows
                </div>
              )}
            </Card>
          )}

          {/* Invalid rows */}
          {preview.invalid.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <div
                style={{
                  padding: "14px 20px 10px",
                  borderBottom: `1px solid ${C.gray100}`,
                }}
              >
                <SectionLabel>
                  Invalid Rows ({preview.invalid.length})
                </SectionLabel>
              </div>
              <DataTable
                headers={["Row data", "Errors"]}
                isLoading={false}
                isEmpty={false}
                colCount={2}
              >
                {preview.invalid.map((item, i) => (
                  <TR key={i}>
                    <TD>
                      <code style={{ fontSize: 11, color: C.gray500 }}>
                        {JSON.stringify(item.raw).slice(0, 100)}
                      </code>
                    </TD>
                    <TD>
                      <span style={{ fontSize: 12, color: C.red }}>
                        {item.errors.join("; ")}
                      </span>
                    </TD>
                  </TR>
                ))}
              </DataTable>
            </Card>
          )}

          {importMut.isError && (
            <ErrorBanner
              message={
                importMut.error instanceof Error
                  ? importMut.error.message
                  : "Import failed"
              }
            />
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {preview.valid.length > 0 && (
              <PrimaryBtn
                disabled={importMut.isPending}
                onClick={() => importMut.mutate(preview.valid)}
              >
                {importMut.isPending
                  ? "Importing…"
                  : `✅ Confirm Import (${preview.valid.length} rows)`}
              </PrimaryBtn>
            )}
            <SecondaryBtn
              onClick={() => {
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Cancel / Re-upload
            </SecondaryBtn>
          </div>
        </>
      )}

      {/* Step 3 — Done */}
      {done && (
        <Card padding="32px" style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: C.gray900 }}>
            Import complete
          </h2>
          <p style={{ color: C.gray500, fontSize: 14, margin: "0 0 8px" }}>
            <strong style={{ color: C.green }}>{done.inserted}</strong> payment
            {done.inserted !== 1 ? "s" : ""} recorded from <em>{filename}</em>.
          </p>
          {done.errors.length > 0 && (
            <p
              style={{
                color: C.red,
                fontSize: 13,
                margin: "0 0 20px",
              }}
            >
              {done.errors.length} row
              {done.errors.length !== 1 ? "s" : ""} failed to insert.
            </p>
          )}
          {done.errors.length === 0 && (
            <p style={{ color: C.gray400, fontSize: 13, margin: "0 0 20px" }}>
              All rows inserted successfully.
            </p>
          )}

          {done.errors.length > 0 && (
            <Card style={{ marginBottom: 20, textAlign: "left" }}>
              <DataTable
                headers={["Row", "Error"]}
                isLoading={false}
                isEmpty={false}
                colCount={2}
              >
                {done.errors.map((e) => (
                  <TR key={e.row}>
                    <TD>
                      <Badge label={`Row ${e.row}`} color="red" />
                    </TD>
                    <TD>
                      <span style={{ fontSize: 12, color: C.red }}>
                        {e.message.slice(0, 120)}
                      </span>
                    </TD>
                  </TR>
                ))}
              </DataTable>
            </Card>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <PrimaryBtn onClick={() => navigate("/finance")}>
              Back to Finance
            </PrimaryBtn>
            <SecondaryBtn
              onClick={() => {
                setDone(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Import another file
            </SecondaryBtn>
          </div>
        </Card>
      )}
    </div>
  );
}
