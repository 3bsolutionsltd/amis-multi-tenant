import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSubmission } from "./marks.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const PROGRAMMES = ["NCBC", "NCES", "NCAM", "NCP", "NCWF"];
const TERMS = ["Term 1", "Term 2", "Term 3"];

export function MarkCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    course_id: "",
    programme: "",
    intake: "2026/2027",
    term: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createSubmission(form);
      navigate(`/marks/${result.submission.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create submission",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Mark Submission"
        back={{ label: "Marks", to: "/marks" }}
      />
      <Card padding="24px" style={{ maxWidth: 480 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Field label="Course ID" required>
            <input
              required
              style={inputCss}
              value={form.course_id}
              placeholder="e.g. NCBC101"
              onChange={(e) => set("course_id", e.target.value)}
            />
          </Field>

          <Field label="Programme" required>
            <select
              required
              style={selectCss}
              value={form.programme}
              onChange={(e) => set("programme", e.target.value)}
            >
              <option value="">— Select Programme —</option>
              {PROGRAMMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Intake" required>
            <input
              required
              style={inputCss}
              value={form.intake}
              onChange={(e) => set("intake", e.target.value)}
            />
          </Field>

          <Field label="Term" required>
            <select
              required
              style={selectCss}
              value={form.term}
              onChange={(e) => set("term", e.target.value)}
            >
              <option value="">— Select Term —</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create Submission"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
