import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStaff, type CreateStaffBody } from "./staff.api";
import { ApiError } from "../../lib/apiFetch";
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

export function StaffCreatePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateStaffBody>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    staff_number: "",
    department: "",
    designation: "",
    employment_type: undefined,
    join_date: "",
    salary: undefined,
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mutation = useMutation({
    mutationFn: (body: CreateStaffBody) => createStaff(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      navigate(`/staff/${created.id}`);
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

  function set(k: keyof CreateStaffBody, v: string) {
    setForm((f) => ({ ...f, [k]: v || undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload: CreateStaffBody = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      staff_number: form.staff_number || undefined,
      department: form.department || undefined,
      designation: form.designation || undefined,
      employment_type: form.employment_type || undefined,
      join_date: form.join_date || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      notes: form.notes || undefined,
    };
    mutation.mutate(payload);
  }

  const apiError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && mutation.error.status === 422)
      ? mutation.error instanceof Error
        ? mutation.error.message
        : "Failed to create staff member"
      : null;

  return (
    <div>
      <PageHeader
        title="New Staff Member"
        description="Add a new staff profile"
        action={
          <SecondaryBtn onClick={() => navigate("/staff")}>
            ← Back to List
          </SecondaryBtn>
        }
      />

      <Card>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <SectionLabel>Personal Information</SectionLabel>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <Field label="First Name" required error={fieldErrors.first_name}>
              <input
                required
                style={inputCss}
                value={form.first_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, first_name: e.target.value }))
                }
              />
            </Field>
            <Field label="Last Name" required error={fieldErrors.last_name}>
              <input
                required
                style={inputCss}
                value={form.last_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, last_name: e.target.value }))
                }
              />
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <Field label="Email" error={fieldErrors.email}>
              <input
                type="email"
                style={inputCss}
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone" error={fieldErrors.phone}>
              <input
                style={inputCss}
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>

          <SectionLabel>Employment Details</SectionLabel>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <Field label="Staff Number" error={fieldErrors.staff_number}>
              <input
                style={inputCss}
                value={form.staff_number ?? ""}
                onChange={(e) => set("staff_number", e.target.value)}
                placeholder="e.g. STF001"
              />
            </Field>
            <Field label="Employment Type" error={fieldErrors.employment_type}>
              <select
                style={selectCss}
                value={form.employment_type ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    employment_type:
                      (e.target.value as CreateStaffBody["employment_type"]) ||
                      undefined,
                  }))
                }
              >
                <option value="">— Select —</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
              </select>
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <Field label="Department" error={fieldErrors.department}>
              <input
                style={inputCss}
                value={form.department ?? ""}
                onChange={(e) => set("department", e.target.value)}
                placeholder="e.g. ICT"
              />
            </Field>
            <Field label="Designation" error={fieldErrors.designation}>
              <input
                style={inputCss}
                value={form.designation ?? ""}
                onChange={(e) => set("designation", e.target.value)}
                placeholder="e.g. Lecturer"
              />
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <Field label="Join Date" error={fieldErrors.join_date}>
              <input
                type="date"
                style={inputCss}
                value={form.join_date ?? ""}
                onChange={(e) => set("join_date", e.target.value)}
              />
            </Field>
            <Field label="Salary" error={fieldErrors.salary}>
              <input
                type="number"
                min={0}
                style={inputCss}
                value={form.salary ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    salary: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </Field>
          </div>

          <Field label="Notes" error={fieldErrors.notes}>
            <textarea
              style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes about this staff member"
            />
          </Field>

          {apiError && <ErrorBanner message={apiError} />}

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <SecondaryBtn type="button" onClick={() => navigate("/staff")}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Create Staff Member"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
