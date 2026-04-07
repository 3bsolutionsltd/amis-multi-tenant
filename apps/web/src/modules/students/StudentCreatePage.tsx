import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, type CreateStudentBody } from "./students.api";
import { ApiError } from "../../lib/apiFetch";
import { useConfig, type StudentFormField } from "../../app/ConfigProvider";

const FALLBACK_FIELDS: StudentFormField[] = [
  {
    key: "first_name",
    label: "First Name *",
    type: "text",
    visible: true,
    order: 1,
  },
  {
    key: "last_name",
    label: "Last Name *",
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate("/students");
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

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>New Student</h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {coreFields.map((f) => (
          <Field key={f.key} label={f.label} error={fieldErrors[f.key]?.[0]}>
            {f.type === "date" ? (
              <input
                type="date"
                style={inputStyle}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : f.type === "textarea" ? (
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                style={inputStyle}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                required={f.key === "first_name" || f.key === "last_name"}
              />
            )}
          </Field>
        ))}

        {extFields.length > 0 && (
          <>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Additional Information
            </p>
            {extFields.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                error={fieldErrors[f.key]?.[0]}
              >
                {f.type === "date" ? (
                  <input
                    type="date"
                    style={inputStyle}
                    value={extForm[f.key] ?? ""}
                    onChange={(e) =>
                      setExtForm({ ...extForm, [f.key]: e.target.value })
                    }
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    style={{ ...inputStyle, minHeight: 80 }}
                    value={extForm[f.key] ?? ""}
                    onChange={(e) =>
                      setExtForm({ ...extForm, [f.key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    style={inputStyle}
                    value={extForm[f.key] ?? ""}
                    onChange={(e) =>
                      setExtForm({ ...extForm, [f.key]: e.target.value })
                    }
                  />
                )}
              </Field>
            ))}
          </>
        )}

        {mutation.isError &&
          !(
            mutation.error instanceof ApiError && mutation.error.status === 422
          ) && (
            <p style={{ color: "red", margin: 0 }}>
              Something went wrong. Please try again.
            </p>
          )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              background: "var(--primary-color, #2563EB)",
              color: "#fff",
              border: "none",
              padding: "8px 20px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
              opacity: mutation.isPending ? 0.7 : 1,
            }}
          >
            {mutation.isPending ? "Saving…" : "Create Student"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/students")}
            style={{
              background: "transparent",
              border: "1px solid #d1d5db",
              padding: "8px 20px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
        {label}
      </span>
      {children}
      {error && <span style={{ color: "red", fontSize: 12 }}>{error}</span>}
    </label>
  );
}
