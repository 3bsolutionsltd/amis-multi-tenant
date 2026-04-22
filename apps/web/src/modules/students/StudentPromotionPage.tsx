import { useState } from "react";
import { promoteStudents, demoteStudents, type PromotionBody } from "./students.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  ErrorBanner,
  C,
} from "../../lib/ui";

ensureGlobalCss();

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6];

export function StudentPromotionPage() {
  const [form, setForm] = useState<PromotionBody>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "promote" | "demote"; count: number } | null>(null);

  function set<K extends keyof PromotionBody>(k: K, v: PromotionBody[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setResult(null);
    setError(null);
  }

  async function handleAction(action: "promote" | "demote") {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (action === "promote") {
        const r = await promoteStudents(form);
        setResult({ type: "promote", count: r.promoted });
      } else {
        const r = await demoteStudents(form);
        setResult({ type: "demote", count: r.demoted });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Student Promotion / Demotion" />

      <Card>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: C.gray500 }}>
          Bulk-update the year of study for a cohort of active students. Use the filters below to
          narrow the affected students, then click Promote or Demote.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
          <Field label="Programme (optional)">
            <input
              style={inputCss}
              placeholder="e.g. BSCS — leave blank for all programmes"
              value={form.programme ?? ""}
              onChange={(e) => set("programme", e.target.value || undefined)}
            />
          </Field>

          <Field label="Current Year of Study (optional)">
            <select
              style={selectCss}
              value={form.from_year ?? ""}
              onChange={(e) =>
                set("from_year", e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Class Section (optional)">
            <input
              style={inputCss}
              placeholder="e.g. A, B — leave blank for all sections"
              value={form.class_section ?? ""}
              onChange={(e) => set("class_section", e.target.value || undefined)}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div
              style={{
                padding: "12px 16px",
                background: C.greenBg,
                border: `1px solid ${C.green}`,
                borderRadius: 6,
                color: C.greenText,
                fontSize: 14,
              }}
            >
              ✓ {result.count} student{result.count !== 1 ? "s" : ""}{" "}
              {result.type === "promote" ? "promoted" : "demoted"} successfully.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={() => handleAction("promote")}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 0",
                background: loading ? C.gray200 : C.green,
                color: loading ? C.gray500 : "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ↑ Promote (Year +1)
            </button>

            <button
              onClick={() => handleAction("demote")}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 0",
                background: loading ? C.gray200 : C.yellow,
                color: loading ? C.gray500 : "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ↓ Demote (Year −1)
            </button>
          </div>

          <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>
            Note: Students at Year 6 cannot be promoted further. Students at Year 1 cannot be
            demoted. Only active students are affected.
          </p>
        </div>
      </Card>
    </div>
  );
}
