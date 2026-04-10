import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudent,
  updateStudent,
  type UpdateStudentBody,
} from "./students.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Field,
  inputCss,
} from "../../lib/ui";

export function StudentDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { studentFormConfig } = useConfig();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
  });

  const {
    data: student,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["students", id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateStudentBody) => updateStudent(id!, body),
    onSuccess: (updated) => {
      qc.setQueryData(["students", id], updated);
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditing(false);
    },
  });

  function startEdit() {
    setForm({
      first_name: student!.first_name,
      last_name: student!.last_name,
      date_of_birth: student!.date_of_birth ?? "",
    });
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateStudentBody = {
      first_name: form.first_name,
      last_name: form.last_name,
    };
    if (form.date_of_birth) body.date_of_birth = form.date_of_birth;
    mutation.mutate(body);
  }

  const extensionFields = studentFormConfig?.extensionFields ?? [];

  if (isLoading) return <Spinner />;
  if (error || !student)
    return (
      <div>
        <PageHeader
          title="Student"
          back={{ label: "Students", to: "/students" }}
        />
        <ErrorBanner message="Student not found." />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        back={{ label: "Students", to: "/students" }}
        action={
          !editing ? (
            <PrimaryBtn onClick={startEdit}>Edit</PrimaryBtn>
          ) : undefined
        }
      />

      {!editing ? (
        <Card padding="0 24px">
          <DetailRow label="First name">{student.first_name}</DetailRow>
          <DetailRow label="Last name">{student.last_name}</DetailRow>
          <DetailRow label="Date of birth">
            {student.date_of_birth ?? "—"}
          </DetailRow>
          {extensionFields.map((f) => (
            <Fragment key={f.key}>
              <DetailRow label={f.label}>
                {String(student.extension?.[f.key] ?? "—")}
              </DetailRow>
            </Fragment>
          ))}
        </Card>
      ) : (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field label="First name *">
              <input
                style={inputCss}
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Last name *">
              <input
                style={inputCss}
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                style={inputCss}
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm({ ...form, date_of_birth: e.target.value })
                }
              />
            </Field>
            {mutation.isError && (
              <ErrorBanner message="Save failed. Please try again." />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryBtn type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setEditing(false)}>
                Cancel
              </SecondaryBtn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
