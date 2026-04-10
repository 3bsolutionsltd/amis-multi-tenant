import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, type CreateStudentBody } from "./students.api";
import { ApiError } from "../../lib/apiFetch";
import { useConfig, type StudentFormField } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
} from "../../lib/ui";

const FALLBACK_FIELDS: StudentFormField[] = [
  { key: "first_name", label: "First Name", type: "text", visible: true, order: 1 },
  { key: "last_name", label: "Last Name", type: "text", visible: true, order: 2 },
  { key: "date_of_birth", label: "Date of Birth", type: "date", visible: true, order: 3 },
];

export function StudentCreatePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { studentFormConfig } = useConfig();

  const coreFields =
    studentFormConfig?.fields
      ?.filter((f) => f.visible !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) ?? FALLBACK_FIELDS;

  const extFields =
    studentFormConfig?.extensionFields
      ?.filter((f) => f.visible !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) ?? [];

  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(coreFields.map((f) => [f.key, ""])),
  );
  const [extForm, setExtForm] = useState<Record<string, string>>(
    Object.fromEntries(extFields.map((f) => [f.key, ""])),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mutation = useMutation({
    mutationFn: (body: CreateStudentBody) => createStudent(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate(`/students/${created.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as {
          error?: { fieldErrors?: Record<string, string[]> };
        };
        setFieldErrors(body?.error?.fieldErrors ?? {});
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload: CreateStudentBody = {
      first_name: form.first_name ?? "",
      last_name: form.last_name ?? "",
    };
    if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
    if (extFields.length > 0) {
      const ext: Record<string, unknown> = {};
      for (const f of extFields) {
        if (extForm[f.key]) ext[f.key] = extForm[f.key];
      }
      payload.extension = ext;
    }
    mutation.mutate(payload);
  }

  const apiError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && mutation.error.status === 422)
      ? "Something went wrong. Please try again."
      : null;

  return (
    <div>
      <PageHeader title="New Student" back={{ label: "Students", to: "/students" }} />
      <Card padding="24px" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {coreFields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              required={f.key === "first_name" || f.key === "last_name"}
              error={fieldErrors[f.key]?.[0]}
            >
              {f.type === "date" ? (
                <input
                  type="date"
                  style={inputCss}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  style={{ ...inputCss, minHeight: 80 }}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  style={inputCss}
                  value={form[f.key] ?? ""}
                  required={f.key === "first_name" || f.key === "last_name"}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}

          {extFields.length > 0 && (
            <>
              <SectionLabel>Additional Information</SectionLabel>
              {extFields.map((f) => (
                <Field key={f.key} label={f.label} error={fieldErrors[f.key]?.[0]}>
                  {f.type === "date" ? (
                    <input
                      type="date"
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) => setExtForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  ) : f.type === "textarea" ? (
                    <textarea
                      style={{ ...inputCss, minHeight: 80 }}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) => setExtForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) => setExtForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
            </>
          )}

          {apiError && <ErrorBanner message={apiError} />}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create Student"}
            </PrimaryBtn>
            <SecondaryBtn type="button" onClick={() => navigate("/students")}>
              Cancel
            </SecondaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}