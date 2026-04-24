import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createIndustrialTraining } from "./industrial-training.api";
import type { TrainingStatus } from "./industrial-training.api";
import { StudentPickerInput } from "../../lib/StudentPickerInput";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  SectionLabel,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Field,
  inputCss,
  selectCss,
} from "../../lib/ui";

const STATUSES: TrainingStatus[] = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
];

export function IndustrialTrainingCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const { departments } = useConfig();

  const [form, setForm] = useState({
    student_id: "",
    student_name: "",
    company: "",
    supervisor: "",
    department: "",
    start_date: "",
    end_date: "",
    status: "scheduled" as TrainingStatus,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mut = useMutation({
    mutationFn: () =>
      createIndustrialTraining({
        student_id: form.student_id,
        company: form.company,
        supervisor: form.supervisor || undefined,
        department: form.department || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        status: form.status,
        notes: form.notes || undefined,
      }),
    onSuccess: (data) => {
      navigate(`/industrial-training/${data.id}`);
    },
    onError: (err) => {
      setErrors({ _: err instanceof Error ? err.message : "Failed to create record" });
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.student_id.trim()) e.student_id = "Student ID is required";
    if (!form.company.trim()) e.company = "Company is required";
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    mut.mutate();
  }

  function f(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  return (
    <div>
      <PageHeader
        title="New Industrial Training Record"
        back={{ label: "Industrial Training", to: "/industrial-training" }}
      />

      <Card padding="20px 24px">
        <SectionLabel>Training Details</SectionLabel>
        {errors._ && <ErrorBanner message={errors._} />}

        <Field label="Student" required error={errors.student_id}>
          <StudentPickerInput
            value={form.student_id}
            displayName={form.student_name}
            onChange={(id, name) => {
              setForm((prev) => ({ ...prev, student_id: id, student_name: name }));
              if (errors.student_id) setErrors((e) => ({ ...e, student_id: "" }));
            }}
            error={errors.student_id}
          />
        </Field>
        <Field label="Company / Employer" required error={errors.company}>
          <input
            style={inputCss}
            placeholder="e.g. ZESA Holdings"
            value={form.company}
            onChange={(e) => f("company", e.target.value)}
          />
        </Field>
        <Field label="Department">
          {departments.length > 0 ? (
            <select
              style={selectCss}
              value={form.department}
              onChange={(e) => f("department", e.target.value)}
            >
              <option value="">— Select department —</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input
              style={inputCss}
              placeholder="e.g. Engineering"
              value={form.department}
              onChange={(e) => f("department", e.target.value)}
            />
          )}
        </Field>
        <Field label="Supervisor">
          <input
            style={inputCss}
            placeholder="Supervisor name"
            value={form.supervisor}
            onChange={(e) => f("supervisor", e.target.value)}
          />
        </Field>
        <Field label="Start Date">
          <input
            type="date"
            style={inputCss}
            value={form.start_date}
            onChange={(e) => f("start_date", e.target.value)}
          />
        </Field>
        <Field label="End Date">
          <input
            type="date"
            style={inputCss}
            value={form.end_date}
            onChange={(e) => f("end_date", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            style={inputCss}
            value={form.status}
            onChange={(e) => f("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
            placeholder="Any additional notes…"
            value={form.notes}
            onChange={(e) => f("notes", e.target.value)}
          />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <PrimaryBtn onClick={handleSubmit} disabled={mut.isPending}>
            {mut.isPending ? "Creating…" : "Create Record"}
          </PrimaryBtn>
          <SecondaryBtn onClick={() => navigate("/industrial-training")}>
            Cancel
          </SecondaryBtn>
        </div>
      </Card>
    </div>
  );
}
