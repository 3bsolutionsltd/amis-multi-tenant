import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, type CreateStudentBody } from "./students.api";
import { listProgrammes } from "../programmes/programmes.api";
import { ApiError } from "../../lib/apiFetch";
import { useConfig, type StudentFormField } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  C,
} from "../../lib/ui";

const FALLBACK_FIELDS: StudentFormField[] = [
  {
    key: "first_name",
    label: "First Name",
    type: "text",
    visible: true,
    order: 1,
  },
  {
    key: "last_name",
    label: "Last Name",
    type: "text",
    visible: true,
    order: 2,
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    type: "date",
    visible: true,
    order: 3,
  },
];

export function StudentCreatePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { studentFormConfig } = useConfig();

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

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
  const [guardianForm, setGuardianForm] = useState({
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    guardian_relationship: "",
  });
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
    if (guardianForm.guardian_name) payload.guardian_name = guardianForm.guardian_name;
    if (guardianForm.guardian_phone) payload.guardian_phone = guardianForm.guardian_phone;
    if (guardianForm.guardian_email) payload.guardian_email = guardianForm.guardian_email;
    if (guardianForm.guardian_relationship) payload.guardian_relationship = guardianForm.guardian_relationship;
    mutation.mutate(payload);
  }

  const apiError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && mutation.error.status === 422)
      ? "Something went wrong. Please try again."
      : null;

  return (
    <div>
      <PageHeader
        title="New Student"
        back={{ label: "Students", to: "/students" }}
      />
      <Card padding="24px" style={{ maxWidth: 520 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ) : f.type === "textarea" ? (
                <textarea
                  style={{ ...inputCss, minHeight: 80 }}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ) : f.key === "programme" ? (
                <select
                  style={selectCss}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                >
                  <option value="">— Select Programme —</option>
                  {(programmes ?? []).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={inputCss}
                  value={form[f.key] ?? ""}
                  required={f.key === "first_name" || f.key === "last_name"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}

          {extFields.length > 0 && (
            <>
              <SectionLabel>Additional Information</SectionLabel>
              {extFields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  error={fieldErrors[f.key]?.[0]}
                >
                  {f.type === "date" ? (
                    <input
                      type="date"
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  ) : f.type === "textarea" ? (
                    <textarea
                      style={{ ...inputCss, minHeight: 80 }}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  )}
                </Field>
              ))}
            </>
          )}

          {apiError && <ErrorBanner message={apiError} />}

          {/* Guardian / Next-of-Kin section (SR-F-002) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 8 }}>Guardian / Next of Kin (optional)</div>
          <Field label="Guardian name">
            <input
              style={inputCss}
              value={guardianForm.guardian_name}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_name: e.target.value }))}
              placeholder="Full name"
            />
          </Field>
          <Field label="Relationship">
            <input
              style={inputCss}
              value={guardianForm.guardian_relationship}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_relationship: e.target.value }))}
              placeholder="e.g. Mother, Father, Sibling"
            />
          </Field>
          <Field label="Guardian phone">
            <input
              style={inputCss}
              value={guardianForm.guardian_phone}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_phone: e.target.value }))}
              placeholder="+256 …"
            />
          </Field>
          <Field label="Guardian email">
            <input
              type="email"
              style={inputCss}
              value={guardianForm.guardian_email}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_email: e.target.value }))}
              placeholder="guardian@example.com"
            />
          </Field>

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
