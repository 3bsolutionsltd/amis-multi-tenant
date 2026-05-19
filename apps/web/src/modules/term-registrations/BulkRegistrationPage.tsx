import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  academic_year_id: string;
  is_current: boolean;
}

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
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedTermName, setSelectedTermName] = useState("");
  const [ids, setIds] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const yearsQ = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => apiFetch<AcademicYear[]>("/academic-years"),
  });

  const selectedYear = yearsQ.data?.find((y) => y.id === selectedYearId);

  const termsQ = useQuery({
    queryKey: ["terms", selectedYearId],
    queryFn: () => apiFetch<Term[]>(`/terms?academic_year_id=${selectedYearId}`),
    enabled: !!selectedYearId,
  });

  // Derive the string values the API needs
  const academicYearName = selectedYear?.name ?? "";

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkRegister({
        academic_year: academicYearName,
        term: selectedTermName,
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
    mutationFn: () => promote({ academic_year: academicYearName, term: selectedTermName }),
    onSuccess: (d) =>
      setResult(`Auto-promoted ${d.registered} active students`),
    onError: (e: Error) => setResult(`Error: ${e.message}`),
  });

  return (
    <div>
      <PageHeader title="Bulk Term Registration" />

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel>Term Info</SectionLabel>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              setSelectedTermName("");
            }}
            style={{ ...inputCss, width: 240 }}
          >
            <option value="">Select Academic Year…</option>
            {(yearsQ.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}{y.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
          <select
            value={selectedTermName}
            onChange={(e) => setSelectedTermName(e.target.value)}
            style={{ ...inputCss, width: 200 }}
            disabled={!selectedYearId}
          >
            <option value="">Select Term…</option>
            {(termsQ.data ?? []).map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}{t.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <SectionLabel>Option 1: Promote All Active Students</SectionLabel>
        <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
          Auto-registers all active students who are not yet registered for this
          term.
        </p>
        <SecondaryBtn
          onClick={() => promoteMut.mutate()}
          disabled={!academicYearName || !selectedTermName || promoteMut.isPending}
        >
          {promoteMut.isPending ? "Promoting…" : "Promote All Active"}
        </SecondaryBtn>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionLabel>Option 2: Register Specific Students</SectionLabel>
        <textarea
          placeholder="Paste student IDs — one per line or comma-separated"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          rows={6}
          style={{ ...inputCss, width: "100%", marginBottom: 12, fontFamily: "monospace" }}
        />
        <PrimaryBtn
          onClick={() => bulkMut.mutate()}
          disabled={!academicYearName || !selectedTermName || !ids.trim() || bulkMut.isPending}
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
