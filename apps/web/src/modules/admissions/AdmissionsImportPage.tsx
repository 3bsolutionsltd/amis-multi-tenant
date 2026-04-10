import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { previewImport, confirmImport, type ImportPreviewResult } from "./admissions.api";
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
// Simple CSV parser: first row = headers, remaining rows = data objects
// ---------------------------------------------------------------------------
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AdmissionsImportPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [filename, setFilename] = useState("");

  const previewMut = useMutation({
    mutationFn: ({ name, rows }: { name: string; rows: Record<string, unknown>[] }) =>
      previewImport(name, rows),
    onSuccess: (result) => {
      setPreview(result);
    },
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmImport(preview!.batchId),
    onSuccess: (result) => {
      setDone(result);
      setPreview(null);
    },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setPreview(null);
    setDone(null);
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
        previewMut.mutate({ name: file.name, rows: rows as Record<string, unknown>[] });
      } catch {
        setParseError("Failed to parse CSV. Ensure it is a valid comma-separated file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        title="Import Admissions"
        back={{ label: "Admissions", to: "/admissions" }}
      />

      {/* Step 1 — Upload */}
      {!preview && !done && (
        <Card padding="24px" style={{ marginBottom: 20, maxWidth: 560 }}>
          <SectionLabel>Step 1 — Upload CSV File</SectionLabel>
          <p style={{ fontSize: 14, color: C.gray500, margin: "8px 0 20px" }}>
            CSV must have headers:{" "}
            <code
              style={{
                background: C.gray100,
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              first_name, last_name, programme, intake
            </code>{" "}
            (required). Optional:{" "}
            <code
              style={{
                background: C.gray100,
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              dob, gender, email, phone, sponsorship_type
            </code>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          {parseError && <ErrorBanner message={parseError} />}
          {previewMut.isError && (
            <ErrorBanner
              message={
                previewMut.error instanceof Error
                  ? previewMut.error.message
                  : "Preview failed"
              }
            />
          )}
          <PrimaryBtn
            disabled={previewMut.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {previewMut.isPending ? "Parsing…" : "📂 Choose CSV File"}
          </PrimaryBtn>
        </Card>
      )}

      {/* Step 2 — Preview */}
      {preview && !done && (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: `1px solid ${C.gray200}`,
                borderRadius: 8,
                padding: "12px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11, color: C.gray500, fontWeight: 700, textTransform: "uppercase" }}>
                Total rows
              </span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{preview.total}</span>
            </div>
            <div
              style={{
                background: "#fff",
                border: `1px solid ${C.greenBg}`,
                borderRadius: 8,
                padding: "12px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11, color: C.green, fontWeight: 700, textTransform: "uppercase" }}>
                Valid
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, color: C.green }}>
                {preview.valid.length}
              </span>
            </div>
            <div
              style={{
                background: "#fff",
                border: `1px solid ${preview.invalid.length > 0 ? "#fca5a5" : C.gray200}`,
                borderRadius: 8,
                padding: "12px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11, color: preview.invalid.length > 0 ? C.red : C.gray500, fontWeight: 700, textTransform: "uppercase" }}>
                Invalid
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: preview.invalid.length > 0 ? C.red : C.gray400,
                }}
              >
                {preview.invalid.length}
              </span>
            </div>
          </div>

          {/* Valid rows preview */}
          {preview.valid.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ padding: "14px 20px 10px", borderBottom: `1px solid ${C.gray100}` }}>
                <SectionLabel>
                  Step 2 — Valid Rows ({preview.valid.length})
                </SectionLabel>
              </div>
              <DataTable
                headers={["Name", "Programme", "Intake", "DOB", "Email"]}
                isLoading={false}
                isEmpty={false}
                colCount={5}
              >
                {preview.valid.slice(0, 50).map((row, i) => (
                  <TR key={i}>
                    <TD>
                      <span style={{ fontWeight: 500 }}>
                        {String(row.first_name ?? "")} {String(row.last_name ?? "")}
                      </span>
                    </TD>
                    <TD>{String(row.programme ?? "—")}</TD>
                    <TD>{String(row.intake ?? "—")}</TD>
                    <TD muted>{String(row.dob ?? "—")}</TD>
                    <TD muted>{String(row.email ?? "—")}</TD>
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
              <div style={{ padding: "14px 20px 10px", borderBottom: `1px solid ${C.gray100}` }}>
                <SectionLabel>Invalid Rows ({preview.invalid.length})</SectionLabel>
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
                        {JSON.stringify(item.row).slice(0, 100)}…
                      </code>
                    </TD>
                    <TD>
                      <Badge label="Invalid" color="red" />
                    </TD>
                  </TR>
                ))}
              </DataTable>
            </Card>
          )}

          {confirmMut.isError && (
            <ErrorBanner
              message={
                confirmMut.error instanceof Error
                  ? confirmMut.error.message
                  : "Import failed"
              }
            />
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {preview.valid.length > 0 && (
              <PrimaryBtn
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending
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
          <p style={{ color: C.gray500, fontSize: 14, margin: "0 0 24px" }}>
            <strong style={{ color: C.green }}>{done.imported}</strong> applications
            imported
            {done.skipped > 0 && (
              <>, <strong style={{ color: C.yellow }}>{done.skipped}</strong> skipped</>
            )}
            {" "}from <em>{filename}</em>.
          </p>
          <PrimaryBtn onClick={() => navigate("/admissions")}>
            View Admissions →
          </PrimaryBtn>
        </Card>
      )}
    </div>
  );
}
