import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApplication } from "./admissions.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listAcademicYears } from "../academic-calendar/academic-calendar.api";
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

const SPONSORSHIP_TYPES = ["Government", "Private", "Self-Sponsored", "Scholarship", "Other"];

export function ApplicationCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const { data: academicYears } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
    staleTime: 60_000,
  });

  // Default intake to current academic year name, or first available
  const defaultIntake = (academicYears ?? []).find((y) => y.is_current)?.name
    ?? (academicYears ?? [])[0]?.name
    ?? "";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    programme: "",
    intake: "",
    sponsorship_type: "",
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
      const body = {
        first_name: form.first_name,
        last_name: form.last_name,
        programme: form.programme,
        intake: form.intake,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        sponsorship_type: form.sponsorship_type || undefined,
      };
      const result = await createApplication(body);
      navigate(`/admissions/${result.application.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit application",
      );
    } finally {
      setSaving(false);
    }
  }

  const twoColGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  };

  return (
    <div>
      <PageHeader
        title="New Application"
        back={{ label: "Admissions", to: "/admissions" }}
      />
      <Card padding="24px" style={{ maxWidth: 640 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={twoColGrid}>
            <Field label="First Name" required>
              <input
                required
                style={inputCss}
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last Name" required>
              <input
                required
                style={inputCss}
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>

          <div style={twoColGrid}>
            <Field label="Email">
              <input
                type="email"
                style={inputCss}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                style={inputCss}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>

          <div style={twoColGrid}>
            <Field label="Date of Birth">
              <input
                type="date"
                style={inputCss}
                value={form.dob}
                onChange={(e) => set("dob", e.target.value)}
              />
            </Field>
            <Field label="Gender">
              <select
                style={selectCss}
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </Field>
          </div>

          <div style={twoColGrid}>
            <Field label="Programme" required>
              <select
                required
                style={selectCss}
                value={form.programme}
                onChange={(e) => set("programme", e.target.value)}
              >
                <option value="">— Select Programme —</option>
                {(programmes ?? []).map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Intake" required>
              <select
                required
                style={selectCss}
                value={form.intake || defaultIntake}
                onChange={(e) => set("intake", e.target.value)}
              >
                <option value="">— Select Intake —</option>
                {(academicYears ?? []).map((y) => (
                  <option key={y.id} value={y.name}>
                    {y.name}{y.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Sponsorship Type">
            <select
              style={selectCss}
              value={form.sponsorship_type}
              onChange={(e) => set("sponsorship_type", e.target.value)}
            >
              <option value="">— Select —</option>
              {SPONSORSHIP_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Submitting…" : "Submit Application"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
