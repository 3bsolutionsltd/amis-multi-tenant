import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { importStudents, updateStudent, type ImportResult } from "./students.api";
import { listProgrammes } from "../programmes/programmes.api";
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
// RFC 4180-compliant CSV parser
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
// Field mapping definitions
// ---------------------------------------------------------------------------
type MappedField = {
  label: string;
  key: string;        // what we rename the CSV header to
  required?: boolean;
};

// Sentinel key for the combined full-name column
const FULL_NAME_KEY = "__full_name__";

const SYSTEM_FIELDS: MappedField[] = [
  { label: "Admission / Reg. Number", key: "Student Reg.Number" },
  {
    label: "Full Name (combined — will be split automatically)",
    key: FULL_NAME_KEY,
  },
  { label: "First Name (separate column)", key: "First Name" },
  { label: "Last Name (separate column)", key: "Last Name" },
  { label: "Other / Middle Name (separate column)", key: "Other Name" },
  { label: "Gender", key: "Gender" },
  { label: "Date of Birth (DD/MM/YYYY)", key: "Date of Birth" },
  { label: "National ID / NIN", key: "National ID/NIN" },
  { label: "Phone", key: "phone number" },
  { label: "Email", key: "EMAIL" },
  { label: "District of Origin", key: "District of Orign" },
  { label: "Next of Kin Name", key: "Next of kin Name" },
  { label: "Next of Kin Phone", key: "Next of kin phone" },
  { label: "Programme", key: "Programme" },
  { label: "Intake Year", key: "Intake Year" },
  { label: "Enrolled Status (active/enrolled/yes = active)", key: "Enrolled status" },
  { label: "Sponsorship Type", key: "sponsorship" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function StudentsImportPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parseError, setParseError] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState("");
  // mapping: systemFieldKey → csvHeader (or "" to skip)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  // "fml" = First Middle Last (default) | "lfm" = Last First Middle (common in KTI/Uganda exports)
  const [nameFormat, setNameFormat] = useState<"fml" | "lfm">("fml");
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fixSelections, setFixSelections] = useState<Record<string, string>>({});
  const [fixApplying, setFixApplying] = useState(false);
  const [fixApplied, setFixApplied] = useState(0);

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes", "import-helper"],
    queryFn: () => listProgrammes({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const importMut = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => importStudents(rows),
    onSuccess: (res) => {
      setResult(res);
      setStep("done");
    },
  });

  // ── Step 1: File upload ──────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setStep("upload");
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
        const headers = Object.keys(rows[0]);
        setCsvHeaders(headers);
        setCsvRows(rows);

        // Auto-map: if CSV header matches a system field key exactly, pre-select it
        const autoMap: Record<string, string> = {};
        for (const sf of SYSTEM_FIELDS) {
          const matched = headers.find(
            (h) => h.toLowerCase().trim() === sf.key.toLowerCase().trim(),
          );
          if (matched) autoMap[sf.key] = matched;
        }
        setMapping(autoMap);
        setStep("map");
      } catch {
        setParseError("Failed to parse CSV. Ensure it is a valid comma-separated file.");
      }
    };
    reader.readAsText(file);
  }

  // ── Step 2: Mapping ──────────────────────────────────────────────────────
  function setFieldMapping(systemKey: string, csvHeader: string) {
    setMapping((prev) => ({ ...prev, [systemKey]: csvHeader }));
  }

  function handleMappingNext() {
    const hasFullName = !!mapping[FULL_NAME_KEY];
    const hasFirst = !!mapping["First Name"];
    const hasLast = !!mapping["Last Name"];
    if (!hasFullName && (!hasFirst || !hasLast)) {
      setParseError(
        "Map either the \"Full Name\" column OR both \"First Name\" and \"Last Name\" columns.",
      );
      return;
    }
    setParseError(null);
    setStep("preview");
  }

  /** Split a full name string into parts based on the chosen format. */
  function splitFullName(raw: string): { first: string; last: string; other: string } {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: "", last: "", other: "" };
    if (parts.length === 1) return { first: parts[0], last: "", other: "" };
    if (nameFormat === "lfm") {
      // Last First [Middle...]
      return {
        last: parts[0],
        first: parts[1],
        other: parts.slice(2).join(" "),
      };
    }
    // fml — First [Middle...] Last
    return {
      first: parts[0],
      last: parts[parts.length - 1],
      other: parts.slice(1, -1).join(" "),
    };
  }

  // Remap rows according to the user's column mapping (keys become system field keys)
  function remapRows(): Record<string, unknown>[] {
    return csvRows.map((row) => {
      const out: Record<string, unknown> = {};
      // copy original keys too (API has fallback aliases)
      Object.assign(out, row);
      for (const [sysKey, csvHeader] of Object.entries(mapping)) {
        if (csvHeader) out[sysKey] = row[csvHeader] ?? "";
      }
      // If full-name column is mapped, split it and inject the name fields
      if (mapping[FULL_NAME_KEY]) {
        const raw = String(row[mapping[FULL_NAME_KEY]] ?? "");
        const { first, last, other } = splitFullName(raw);
        out["First Name"] = first;
        out["Last Name"] = last;
        if (other) out["Other Name"] = other;
      }
      return out;
    });
  }

  /** Preview a single row with the name split applied (for the preview table). */
  function previewCellValue(row: Record<string, string>, sf: MappedField): string {
    if (sf.key === FULL_NAME_KEY && mapping[FULL_NAME_KEY]) {
      const raw = String(row[mapping[FULL_NAME_KEY]] ?? "");
      const { first, last, other } = splitFullName(raw);
      return [first, other, last].filter(Boolean).join(" → ");
    }
    return row[mapping[sf.key]] ?? "";
  }

  // ── Step 3: Preview ──────────────────────────────────────────────────────
  function handleConfirm() {
    importMut.mutate(remapRows());
  }

  async function handleApplyFixes() {
    setFixApplying(true);
    let fixed = 0;
    for (const [studentId, programmeId] of Object.entries(fixSelections)) {
      if (!programmeId) continue;
      const prog = programmes.find((p) => p.id === programmeId);
      if (!prog) continue;
      try {
        await updateStudent(studentId, { programme: prog.title, programme_id: prog.id });
        fixed++;
      } catch {
        // continue with remaining fixes
      }
    }
    setFixApplied((prev) => prev + fixed);
    setFixSelections({});
    setFixApplying(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const previewRows = csvRows.slice(0, 10);
  const mappedSystemFields = SYSTEM_FIELDS.filter((sf) => mapping[sf.key]);
  const usingFullName = !!mapping[FULL_NAME_KEY];

  return (
    <div>
      <PageHeader
        title="Import Students from CSV"
        back={{ label: "Students", to: "/students" }}
      />

      {parseError && <ErrorBanner message={parseError} />}

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card padding="24px" style={{ maxWidth: 600 }}>
          <SectionLabel>Step 1 — Choose a CSV File</SectionLabel>
          <p style={{ fontSize: 14, color: C.gray500, margin: "8px 0 20px" }}>
            Upload a CSV with student data. Headers will be mapped to system fields
            in the next step. Accepts KTI-style exports or custom layouts.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <PrimaryBtn onClick={() => fileRef.current?.click()}>
            📂 Choose CSV File
          </PrimaryBtn>
        </Card>
      )}

      {/* ── Step 2: Map columns ────────────────────────────────────────── */}
      {step === "map" && (
        <Card padding="24px" style={{ maxWidth: 700 }}>
          <SectionLabel>Step 2 — Map Columns</SectionLabel>
          <p style={{ fontSize: 14, color: C.gray500, margin: "8px 0 20px" }}>
            File: <strong>{filename}</strong> — {csvRows.length.toLocaleString()} data rows detected.
            Match each system field to its corresponding CSV column (or leave blank to skip).
          </p>

          {/* Full-name split helper notice */}
          <div
            style={{
              background: C.blueBg,
              border: `1px solid ${C.blue}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: C.blueText,
              marginBottom: 18,
            }}
          >
            <strong>Tip:</strong> If all names are in one column (e.g. "Mwesigwa John Paul"),
            map it to <em>Full Name (combined)</em> and choose the order below.
            If names are already in separate columns, map <em>First Name</em> and <em>Last Name</em> instead.
          </div>

          {/* Name format selector — only visible when full-name column is mapped */}
          {usingFullName && (
            <div
              style={{
                background: C.yellowBg,
                border: `1px solid ${C.yellow}`,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: C.yellowText,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <strong>Name order in that column:</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="nameFormat"
                  value="fml"
                  checked={nameFormat === "fml"}
                  onChange={() => setNameFormat("fml")}
                />
                First · Middle · Last
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="nameFormat"
                  value="lfm"
                  checked={nameFormat === "lfm"}
                  onChange={() => setNameFormat("lfm")}
                />
                Last · First · Middle
              </label>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 24 }}>
            {SYSTEM_FIELDS.map((sf) => (
              <div key={sf.key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 4 }}>
                  {sf.label}
                  {sf.required && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
                </label>
                <select
                  value={mapping[sf.key] ?? ""}
                  onChange={(e) => setFieldMapping(sf.key, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: `1px solid ${C.gray300}`,
                    borderRadius: 6,
                    fontSize: 13,
                    color: C.gray800,
                    background: "#fff",
                  }}
                >
                  <option value="">— skip —</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {programmes.length > 0 && (
            <div
              style={{
                fontSize: 12,
                color: C.gray600,
                background: C.gray50,
                border: `1px solid ${C.gray200}`,
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 20,
                lineHeight: 1.8,
              }}
            >
              <strong>Known programmes</strong> (valid values for the Programme column):{" "}
              {programmes.map((p) => (
                <span key={p.id} style={{ marginRight: 14, whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 600 }}>{p.code}</span>
                  {" — "}
                  {p.title}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryBtn onClick={handleMappingNext}>Next: Preview →</PrimaryBtn>
            <SecondaryBtn onClick={() => { setStep("upload"); if (fileRef.current) fileRef.current.value = ""; }}>
              ← Choose Different File
            </SecondaryBtn>
          </div>
        </Card>
      )}

      {/* ── Step 3: Preview ────────────────────────────────────────────── */}
      {step === "preview" && (
        <div>
          <Card padding="24px" style={{ marginBottom: 20 }}>
            <SectionLabel>Step 3 — Preview (first {Math.min(previewRows.length, 10)} rows)</SectionLabel>
            <p style={{ fontSize: 14, color: C.gray500, margin: "8px 0 16px" }}>
              Showing mapped fields only. {csvRows.length.toLocaleString()} total rows will be sent.
            </p>
            <div style={{ overflowX: "auto" }}>
              <DataTable
                headers={[
                  "Row",
                  ...mappedSystemFields.map((sf) =>
                    sf.key === FULL_NAME_KEY
                      ? `Full Name → First / Other / Last (${nameFormat === "lfm" ? "Last·First·Middle" : "First·Middle·Last"})`
                      : sf.label,
                  ),
                ]}
              >
                {previewRows.map((row, idx) => (
                  <TR key={idx}>
                    <TD>{idx + 2}</TD>
                    {mappedSystemFields.map((sf) => (
                      <TD key={sf.key}>{previewCellValue(row, sf)}</TD>
                    ))}
                  </TR>
                ))}
              </DataTable>
            </div>
            {csvRows.length > 10 && (
              <p style={{ fontSize: 13, color: C.gray400, marginTop: 8 }}>
                … and {csvRows.length - 10} more rows not shown.
              </p>
            )}
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryBtn
              disabled={importMut.isPending}
              onClick={handleConfirm}
            >
              {importMut.isPending
                ? `Importing ${csvRows.length.toLocaleString()} rows…`
                : `✅ Confirm Import (${csvRows.length.toLocaleString()} rows)`}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setStep("map")}>← Back to Mapping</SecondaryBtn>
          </div>

          {importMut.isError && (
            <ErrorBanner
              message={
                importMut.error instanceof Error
                  ? importMut.error.message
                  : "Import failed. Please try again."
              }
            />
          )}
        </div>
      )}

      {/* ── Step 4: Done ───────────────────────────────────────────────── */}
      {step === "done" && result && (
        <div>
          <Card padding="24px" style={{ marginBottom: 20, maxWidth: 560 }}>
            <SectionLabel>Import Complete</SectionLabel>
            <div style={{ display: "flex", gap: 16, margin: "16px 0 20px", flexWrap: "wrap" }}>
              <Stat label="Imported" value={result.imported} color={C.green} />
              <Stat label="Skipped" value={result.skipped} color={result.skipped > 0 ? C.yellow : C.gray400} />
              <Stat label="Errors" value={result.errors.length} color={result.errors.length > 0 ? C.red : C.gray400} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <PrimaryBtn onClick={() => navigate("/students")}>Go to Students List</PrimaryBtn>
              <SecondaryBtn
                onClick={() => {
                  setStep("upload");
                  setCsvRows([]);
                  setCsvHeaders([]);
                  setMapping({});
                  setResult(null);
                  setFixSelections({});
                  setFixApplied(0);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Import Another File
              </SecondaryBtn>
            </div>
          </Card>

          {result.errors.length > 0 && (
            <Card padding="24px" style={{ maxWidth: 760 }}>
              <SectionLabel>Row Errors</SectionLabel>
              <p style={{ fontSize: 13, color: C.gray500, margin: "4px 0 16px" }}>
                These rows were skipped. Fix them and re-import.
              </p>
              {result.errors.length > 100 && (
                <p style={{ fontSize: 13, color: C.yellow, marginBottom: 12 }}>
                  Showing first 100 of {result.errors.length} errors.
                </p>
              )}
              <DataTable headers={["Row #", "Reason"]}>
                {result.errors.slice(0, 100).map((e) => (
                  <TR key={e.row}>
                    <TD>
                      <Badge color="red" label={String(e.row)} />
                    </TD>
                    <TD>{e.error}</TD>
                  </TR>
                ))}
              </DataTable>
            </Card>
          )}

          {(result.warnings ?? []).length > 0 && (
            <Card padding="24px" style={{ maxWidth: 900, marginTop: 20 }}>
              <SectionLabel>
                Unmatched Programmes — {(result.warnings ?? []).length} row(s)
              </SectionLabel>
              <p style={{ fontSize: 13, color: C.gray500, margin: "4px 0 16px" }}>
                These students were imported but their programme value did not match any known
                programme. Select the correct programme for each row and click{" "}
                <strong>Apply Fixes</strong>.
              </p>
              <DataTable headers={["Row #", "Student", "CSV Value", "Assign Programme"]}>
                {(result.warnings ?? []).map((w) => (
                  <TR key={w.student_id}>
                    <TD>
                      <Badge color="yellow" label={String(w.row)} />
                    </TD>
                    <TD>{w.student_name}</TD>
                    <TD>
                      <span style={{ color: C.red, fontStyle: "italic" }}>{w.raw_programme}</span>
                    </TD>
                    <TD>
                      <select
                        value={fixSelections[w.student_id] ?? ""}
                        onChange={(e) =>
                          setFixSelections((prev) => ({
                            ...prev,
                            [w.student_id]: e.target.value,
                          }))
                        }
                        style={{
                          padding: "5px 8px",
                          border: `1px solid ${C.gray300}`,
                          borderRadius: 5,
                          fontSize: 13,
                          minWidth: 200,
                        }}
                      >
                        <option value="">— select —</option>
                        {programmes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.title}
                          </option>
                        ))}
                      </select>
                    </TD>
                  </TR>
                ))}
              </DataTable>
              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <PrimaryBtn
                  disabled={
                    fixApplying ||
                    Object.values(fixSelections).filter(Boolean).length === 0
                  }
                  onClick={handleApplyFixes}
                >
                  {fixApplying
                    ? "Applying fixes…"
                    : `Apply Fixes (${Object.values(fixSelections).filter(Boolean).length})`}
                </PrimaryBtn>
                {fixApplied > 0 && (
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                    ✓ {fixApplied} programme(s) fixed
                  </span>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "12px 20px",
        background: C.gray50,
        borderRadius: 8,
        minWidth: 110,
        border: `1px solid ${C.gray200}`,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{label}</div>
    </div>
  );
}
