import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createTermRegistration } from "./term-registrations.api";
import { listStudents, type Student } from "../students/students.api";
import { useConfig } from "../../app/ConfigProvider";

const TERMS = ["Term 1", "Term 2", "Term 3"];

export function TermRegistrationCreatePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    academic_year: "2026/2027",
    term: "Term 1",
  });

  const { data: students } = useQuery({
    queryKey: ["students-search", search],
    queryFn: () => listStudents({ search: search || undefined }),
    enabled: search.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: createTermRegistration,
    onSuccess: (data) => {
      navigate(`/term-registrations/${data.registration.id}`);
    },
  });

  function selectStudent(student: Student) {
    setSelectedStudent(student);
    setSearch(`${student.first_name} ${student.last_name}`);
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    mutation.mutate({
      student_id: selectedStudent.id,
      academic_year: form.academic_year,
      term: form.term,
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 4,
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}
      >
        <button
          onClick={() => navigate("/term-registrations")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>New Term Registration</h2>
      </div>

      {mutation.isError && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "12px 16px",
            color: "#dc2626",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Failed to create registration."}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Student search */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <label style={labelStyle}>Student *</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedStudent) setSelectedStudent(null);
            }}
            placeholder="Search by name (min 2 chars)…"
            required
            style={fieldStyle}
          />
          {students && students.length > 0 && !selectedStudent && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                margin: 0,
                padding: 0,
                listStyle: "none",
                zIndex: 10,
                maxHeight: 200,
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              {students.map((s) => (
                <li
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 14,
                    borderBottom: "1px solid #f3f4f6",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLLIElement).style.background =
                      "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLLIElement).style.background = "")
                  }
                >
                  <span style={{ fontWeight: 600 }}>
                    {s.first_name} {s.last_name}
                  </span>
                  {s.admission_number && (
                    <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 12 }}>
                      {s.admission_number}
                    </span>
                  )}
                  {s.programme && (
                    <span style={{ color: "#9ca3af", marginLeft: 8, fontSize: 12 }}>
                      {s.programme}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {selectedStudent && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#16a34a" }}>
              ✓ {selectedStudent.first_name} {selectedStudent.last_name}
              {selectedStudent.programme ? ` — ${selectedStudent.programme}` : ""}
            </p>
          )}
        </div>

        {/* Academic year */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Academic Year *</label>
          <input
            value={form.academic_year}
            onChange={(e) => set("academic_year", e.target.value)}
            placeholder="e.g. 2026/2027"
            required
            style={fieldStyle}
          />
        </div>

        {/* Term */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Term *</label>
          <select
            value={form.term}
            onChange={(e) => set("term", e.target.value)}
            required
            style={fieldStyle}
          >
            {TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={mutation.isPending || !selectedStudent}
            style={{
              backgroundColor: mutation.isPending ? "#93c5fd" : primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 24px",
              fontWeight: 600,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            {mutation.isPending ? "Creating…" : "Start Registration"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/term-registrations")}
            style={{
              backgroundColor: "#fff",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "10px 20px",
              fontWeight: 600,
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
