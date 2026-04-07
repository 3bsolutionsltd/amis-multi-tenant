import { useState, Fragment } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudent,
  updateStudent,
  type UpdateStudentBody,
} from "./students.api";
import { useConfig } from "../../app/ConfigProvider";

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

  const extensionFields = studentFormConfig?.extensionFields ?? [];

  if (isLoading) return <p>Loading…</p>;
  if (error || !student)
    return (
      <div>
        <Link
          to="/students"
          style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}
        >
          ← Students
        </Link>
        <p style={{ color: "red", marginTop: 16 }}>Student not found.</p>
      </div>
    );

  return (
    <div style={{ maxWidth: 560 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Link
          to="/students"
          style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}
        >
          ← Students
        </Link>
        <h2 style={{ margin: 0 }}>
          {student.first_name} {student.last_name}
        </h2>
      </div>

      {!editing ? (
        <div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "2px 0",
              fontSize: 14,
            }}
          >
            <dt style={{ color: "#6b7280", padding: "6px 0" }}>First name</dt>
            <dd style={{ margin: 0, padding: "6px 0" }}>
              {student.first_name}
            </dd>

            <dt style={{ color: "#6b7280", padding: "6px 0" }}>Last name</dt>
            <dd style={{ margin: 0, padding: "6px 0" }}>{student.last_name}</dd>

            <dt style={{ color: "#6b7280", padding: "6px 0" }}>
              Date of birth
            </dt>
            <dd style={{ margin: 0, padding: "6px 0" }}>
              {student.date_of_birth ?? "—"}
            </dd>

            {extensionFields.map((f) => (
              <Fragment key={f.key}>
                <dt style={{ color: "#6b7280", padding: "6px 0" }}>
                  {f.label}
                </dt>
                <dd style={{ margin: 0, padding: "6px 0" }}>
                  {String(student.extension?.[f.key] ?? "—")}
                </dd>
              </Fragment>
            ))}
          </dl>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={startEdit}
              style={{
                background: "var(--primary-color, #2563EB)",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              First name *
            </span>
            <input
              style={inputStyle}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              Last name *
            </span>
            <input
              style={inputStyle}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              Date of birth
            </span>
            <input
              type="date"
              style={inputStyle}
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
            />
          </label>

          {mutation.isError && (
            <p style={{ color: "red", margin: 0 }}>
              Save failed. Please try again.
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
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
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
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
      )}
    </div>
  );
}
