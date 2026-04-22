import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getTermResults,
  processResults,
  type TermGpaRow,
} from "./results.api";
import { apiFetch } from "../../lib/apiFetch";
import {
  ensureGlobalCss,
  PageHeader,
  StatCard,
  Card,
  DataTable,
  TR,
  TD,
  PrimaryBtn,
  SecondaryBtn,
  Spinner,
  EmptyState,
  SectionLabel,
} from "../../lib/ui";

interface Term {
  id: string;
  name: string;
  is_current: boolean;
}

export function ResultsPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  const termsQ = useQuery({
    queryKey: ["terms"],
    queryFn: () => apiFetch<{ rows: Term[] }>("/terms").then((r) => r.rows),
  });

  // Auto-select current term
  if (!selectedTermId && termsQ.data) {
    const current = termsQ.data.find((t) => t.is_current);
    if (current) setSelectedTermId(current.id);
    else if (termsQ.data.length > 0) setSelectedTermId(termsQ.data[0].id);
  }

  const resultsQ = useQuery({
    queryKey: ["termResults", selectedTermId],
    queryFn: () => getTermResults(selectedTermId),
    enabled: !!selectedTermId,
  });

  const processMut = useMutation({
    mutationFn: () => processResults(selectedTermId),
    onSuccess: (data) => {
      setProcessMsg(
        `Processed ${data.processed} marks for ${data.students} students`,
      );
      qc.invalidateQueries({ queryKey: ["termResults", selectedTermId] });
    },
    onError: (err) => {
      setProcessMsg(err instanceof Error ? err.message : "Processing failed");
    },
  });

  const results: TermGpaRow[] = resultsQ.data ?? [];
  const avgGpa =
    results.length > 0
      ? (
          results.reduce((s, r) => s + Number(r.gpa), 0) / results.length
        ).toFixed(2)
      : "—";

  return (
    <div>
      <PageHeader
        title="End-of-Term Results"
        action={
          <PrimaryBtn
            onClick={() => {
              setProcessMsg(null);
              processMut.mutate();
            }}
            disabled={!selectedTermId || processMut.isPending}
          >
            {processMut.isPending ? "Processing…" : "⚙ Process Results"}
          </PrimaryBtn>
        }
      />

      {/* Term selector */}
      <Card padding="16px 24px" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Term:
          </label>
          {termsQ.isLoading ? (
            <Spinner />
          ) : (
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setProcessMsg(null);
              }}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 7,
                fontSize: 14,
                minWidth: 220,
              }}
            >
              <option value="">Select a term…</option>
              {(termsQ.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {processMsg && (
        <Card
          padding="12px 20px"
          style={{ marginBottom: 16, background: "#f0fdf4" }}
        >
          <span style={{ fontSize: 13, color: "#166534" }}>{processMsg}</span>
        </Card>
      )}

      {/* Stats row */}
      {results.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard
            label="Students Ranked"
            value={results.length.toString()}
            accent="#2563eb"
          />
          <StatCard label="Avg GPA" value={avgGpa} accent="#7c3aed" />
          <StatCard
            label="Highest GPA"
            value={results[0] ? Number(results[0].gpa).toFixed(2) : "—"}
            accent="#16a34a"
          />
        </div>
      )}

      {/* Results table */}
      <Card padding="0">
        <div style={{ padding: "16px 24px 0" }}>
          <SectionLabel>Rankings</SectionLabel>
        </div>
        {resultsQ.isLoading && <Spinner />}
        {!selectedTermId && (
          <EmptyState title="Select a term to view results" />
        )}
        {selectedTermId && results.length === 0 && !resultsQ.isLoading && (
          <EmptyState title="No processed results for this term yet. Click 'Process Results' to generate." />
        )}
        {results.length > 0 && (
          <DataTable
            headers={[
              "Rank",
              "Admission #",
              "Student",
              "GPA",
              "Credits",
              "",
            ]}
          >
            {results.map((r: TermGpaRow) => (
              <TR key={r.student_id}>
                <TD style={{ fontWeight: 700, textAlign: "center" }}>
                  {r.rank ?? "—"}
                </TD>
                <TD>{r.admission_number ?? "—"}</TD>
                <TD>
                  {r.first_name} {r.last_name}
                </TD>
                <TD>{Number(r.gpa).toFixed(2)}</TD>
                <TD>{r.total_credits}</TD>
                <TD>
                  <SecondaryBtn
                    onClick={() =>
                      navigate(
                        `/results/slip?student_id=${r.student_id}&term_id=${selectedTermId}`,
                      )
                    }
                    style={{ fontSize: 11, padding: "4px 10px" }}
                  >
                    📄 Slip
                  </SecondaryBtn>
                </TD>
              </TR>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
