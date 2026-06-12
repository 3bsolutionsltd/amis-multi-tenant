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
const PROGRAMME_TYPES = ["Certificate", "Diploma"] as const;
const MARITAL_STATUSES = ["Single", "Married", "Widowed", "Divorced"];
const RESIDENCY_TYPES = ["Resident", "Non-Resident"];
type ProgrammeType = typeof PROGRAMME_TYPES[number];

const sectionHeading: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase",
  letterSpacing: "0.05em", padding: "8px 0 4px",
  borderBottom: "1px solid #e2e8f0", marginBottom: 8,
};

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
    first_name: "", last_name: "", other_names: "",
    email: "", phone: "", dob: "", gender: "",
    nin: "", nationality: "Ugandan", marital_status: "",
    district_of_origin: "", residency_type: "",
    programme: "", intake: "", sponsorship_type: "",
    // Guardian
    guardian_name: "", guardian_phone: "", guardian_relationship: "",
    // Prior qualifications
    previous_school: "", previous_award: "", year_of_completion: "",
    uvtab_index: "", uvtab_year: "", uvtab_centre: "",
  });
  const [programmeType, setProgrammeType] = useState<ProgrammeType | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Filter programmes by selected type; fall back to all if none selected or
  // if a programme has no level set (treat as compatible with both types).
  const visibleProgrammes = (programmes ?? []).filter((p) => {
    if (!programmeType) return true;
    if (!p.level) return true; // no level set — show in all
    return p.level.toLowerCase().includes(programmeType.toLowerCase());
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Build extension from additional fields
      const extension: Record<string, string> = {};
      if (form.other_names)          extension.other_names = form.other_names;
      if (form.nin)                  extension.nin = form.nin;
      if (form.nationality)          extension.nationality = form.nationality;
      if (form.marital_status)       extension.marital_status = form.marital_status;
      if (form.district_of_origin)   extension.district_of_origin = form.district_of_origin;
      if (form.residency_type)       extension.residency_type = form.residency_type;
      if (form.guardian_name)        extension.guardian_name = form.guardian_name;
      if (form.guardian_phone)       extension.guardian_phone = form.guardian_phone;
      if (form.guardian_relationship) extension.guardian_relationship = form.guardian_relationship;
      if (form.previous_school)      extension.previous_school = form.previous_school;
      if (form.previous_award)       extension.previous_award = form.previous_award;
      if (form.year_of_completion)   extension.year_of_completion = form.year_of_completion;
      if (form.uvtab_index)          extension.uvtab_index = form.uvtab_index;
      if (form.uvtab_year)           extension.uvtab_year = form.uvtab_year;
      if (form.uvtab_centre)         extension.uvtab_centre = form.uvtab_centre;

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
        extension: Object.keys(extension).length > 0 ? extension : undefined,
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
              <input required style={inputCss} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </Field>
            <Field label="Last Name" required>
              <input required style={inputCss} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </Field>
          </div>

          <Field label="Other Names (Middle Name)">
            <input style={inputCss} value={form.other_names} onChange={(e) => set("other_names", e.target.value)} placeholder="Optional" />
          </Field>

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
              <input type="date" style={inputCss} value={form.dob} onChange={(e) => set("dob", e.target.value)} />
            </Field>
            <Field label="Gender">
              <select style={selectCss} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </Field>
          </div>

          <div style={twoColGrid}>
            <Field label="National ID / NIN">
              <input style={inputCss} value={form.nin} onChange={(e) => set("nin", e.target.value)} placeholder="CM91234567890" />
            </Field>
            <Field label="Nationality">
              <input style={inputCss} value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
          </div>

          <div style={twoColGrid}>
            <Field label="Marital Status">
              <select style={selectCss} value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                <option value="">— Select —</option>
                {MARITAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="District of Origin">
              <input style={inputCss} value={form.district_of_origin} onChange={(e) => set("district_of_origin", e.target.value)} placeholder="e.g. Kampala" />
            </Field>
          </div>

          <Field label="Residency">
            <select style={selectCss} value={form.residency_type} onChange={(e) => set("residency_type", e.target.value)}>
              <option value="">— Select —</option>
              {RESIDENCY_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <div style={twoColGrid}>
            <Field label="Programme Type">
              <select
                style={selectCss}
                value={programmeType}
                onChange={(e) => {
                  setProgrammeType(e.target.value as ProgrammeType | "");
                  set("programme", ""); // reset programme when type changes
                }}
              >
                <option value="">— All Types —</option>
                {PROGRAMME_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Programme" required>
              <select
                required
                style={selectCss}
                value={form.programme}
                onChange={(e) => set("programme", e.target.value)}
              >
                <option value="">— Select Programme —</option>
                {visibleProgrammes.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Intake" required>
              <select required style={selectCss} value={form.intake || defaultIntake} onChange={(e) => set("intake", e.target.value)}>
                <option value="">— Select Intake —</option>
                {(academicYears ?? []).map((y) => (
                  <option key={y.id} value={y.name}>{y.name}{y.is_current ? " (Current)" : ""}</option>
                ))}
              </select>
            </Field>

          <Field label="Sponsorship Type">
            <select style={selectCss} value={form.sponsorship_type} onChange={(e) => set("sponsorship_type", e.target.value)}>
              <option value="">— Select —</option>
              {SPONSORSHIP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          {/* Guardian / Parent Information */}
          <div style={sectionHeading}>Guardian / Parent Information</div>
          <div style={twoColGrid}>
            <Field label="Guardian / Parent Name">
              <input style={inputCss} value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Guardian Phone">
              <input type="tel" style={inputCss} value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
            </Field>
          </div>
          <Field label="Relationship to Applicant">
            <input style={inputCss} value={form.guardian_relationship} onChange={(e) => set("guardian_relationship", e.target.value)} placeholder="e.g. Father, Mother, Uncle" />
          </Field>

          {/* Previous Qualifications */}
          <div style={sectionHeading}>Previous Qualifications</div>
          <div style={twoColGrid}>
            <Field label="Previous School / Institution">
              <input style={inputCss} value={form.previous_school} onChange={(e) => set("previous_school", e.target.value)} />
            </Field>
            <Field label="Qualification Obtained">
              <input style={inputCss} value={form.previous_award} onChange={(e) => set("previous_award", e.target.value)} placeholder="e.g. UCE, UACE" />
            </Field>
          </div>
          <Field label="Year of Completion">
            <input style={inputCss} value={form.year_of_completion} onChange={(e) => set("year_of_completion", e.target.value)} placeholder="e.g. 2023" />
          </Field>

          {/* UVTAB / Exams */}
          <div style={sectionHeading}>UVTAB / Examination Results</div>
          <div style={twoColGrid}>
            <Field label="UVTAB Index Number">
              <input style={inputCss} value={form.uvtab_index} onChange={(e) => set("uvtab_index", e.target.value)} placeholder="e.g. U0001/001/2023" />
            </Field>
            <Field label="Year of Examination">
              <input style={inputCss} value={form.uvtab_year} onChange={(e) => set("uvtab_year", e.target.value)} placeholder="e.g. 2023" />
            </Field>
          </div>
          <Field label="Examination Centre">
            <input style={inputCss} value={form.uvtab_centre} onChange={(e) => set("uvtab_centre", e.target.value)} />
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
