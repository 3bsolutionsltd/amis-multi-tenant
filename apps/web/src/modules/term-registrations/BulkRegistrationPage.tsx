import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiFetch";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Spinner,
  SectionLabel,
  inputCss,
  C,
} from "../../lib/ui";

function bulkRegister(body: {
  academic_year: string;
  term: string;
  student_ids: string[];
}) {
  return apiFetch<{ registered: number; skipped: number }>(
    "/term-registrations/bulk",
    { method: "POST", body: JSON.stringify(body) },
  );
}

function promote(body: { academic_year: string; term: string }) {
  return apiFetch<{ registered: number }>(
    "/term-registrations/promote",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function BulkRegistrationPage() {
  ensureGlobalCss();
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");
  const [ids, setIds] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkRegister({
        academic_year: academicYear,
        term,
        student_ids: ids
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (d) =>
      setResult(`Registered: ${d.registered}, Skipped: ${d.skipped}`),
    onError: (e: Error) => setResult(`Error: ${e.message}`),
  });

  const promoteMut = useMutation({
    mutationFn: () => promote({ academic_year: academicYear, term }),
    onSuccess: (d) =>
      setResult(`Auto-promoted ${d.registered} active students`),
    onError: (e: Error) => setResult(`Error: ${e.message}`),
  });

  return (
    <div>
      <PageHeader title="Bulk Term Registration" />

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel>Term Info</SectionLabel>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <input
            className={inputCss}
            placeholder="Academic Year (e.g. 2025/2026)"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            style={{ width: 220 }}
          />
          <input
            className={inputCss}
            placeholder="Term (e.g. Term 1)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{ width: 220 }}
          />
        </div>

        <SectionLabel>Option 1: Promote All Active Students</SectionLabel>
        <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
          Auto-registers all active students who are not yet registered for this
          term.
        </p>
        <SecondaryBtn
          onClick={() => promoteMut.mutate()}
          disabled={!academicYear || !term || promoteMut.isPending}
        >
          {promoteMut.isPending ? "Promoting…" : "Promote All Active"}
        </SecondaryBtn>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionLabel>Option 2: Register Specific Students</SectionLabel>
        <textarea
          className={inputCss}
          placeholder="Paste student IDs — one per line or comma-separated"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          rows={6}
          style={{ width: "100%", marginBottom: 12, fontFamily: "monospace" }}
        />
        <PrimaryBtn
          onClick={() => bulkMut.mutate()}
          disabled={!academicYear || !term || !ids.trim() || bulkMut.isPending}
        >
          {bulkMut.isPending ? "Registering…" : "Register Selected"}
        </PrimaryBtn>
      </Card>

      {result && (
        <Card style={{ padding: 16, marginTop: 16, fontWeight: 600 }}>
          {result}
        </Card>
      )}
    </div>
  );
}
