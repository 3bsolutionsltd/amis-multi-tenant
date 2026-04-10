import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createTermRegistration } from "./term-registrations.api";
import { listStudents, type Student } from "../students/students.api";
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

const TERMS = ["Term 1", "Term 2", "Term 3"];

export function TermRegistrationCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    academic_year: "2026/2027",
    term: "Term 1",
  });
  const [error, setError] = useState<string | null>(null);

  const { data: searchResults } = useQuery({
    queryKey: ["students-search", search],
    queryFn: () => listStudents({ search, page: 1, per_page: 10 }),
    enabled: search.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: createTermRegistration,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["term-registrations"] });
      navigate(`/term-registrations/${data.registration.id}`);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to create registration",
      );
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) {
      setError("Please select a student");
      return;
    }
    setError(null);
    mutation.mutate({
      student_id: selectedStudent.id,
      academic_year: form.academic_year,
      term: form.term,
    });
  }

  function selectStudent(s: Student) {
    setSelectedStudent(s);
    setSearch(`${s.first_name} ${s.last_name}`);
    setShowDropdown(false);
  }

  return (
    <div>
      <PageHeader
        title="New Term Registration"
        back={{ label: "Term Registrations", to: "/term-registrations" }}
      />
      <Card padding="24px" style={{ maxWidth: 480 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Field label="Student" required>
            <div style={{ position: "relative" }}>
              <input
                required={!selectedStudent}
                style={inputCss}
                value={search}
                placeholder="Type to search students…"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedStudent(null);
                  setShowDropdown(true);
                }}
                onFocus={() => search.length >= 2 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                autoComplete="off"
              />
              {showDropdown &&
                searchResults &&
                searchResults.students.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      zIndex: 10,
                      maxHeight: 200,
                      overflowY: "auto",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  >
                    {searchResults.students.map((s) => (
                      <div
                        key={s.id}
                        onMouseDown={() => selectStudent(s)}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: 14,
                        }}
                        onMouseEnter={(e) =>
                          ((e.target as HTMLElement).style.background =
                            "#f9fafb")
                        }
                        onMouseLeave={(e) =>
                          ((e.target as HTMLElement).style.background = "")
                        }
                      >
                        {s.first_name} {s.last_name}
                        {s.student_id && (
                          <span
                            style={{
                              color: "#6b7280",
                              marginLeft: 8,
                              fontSize: 12,
                            }}
                          >
                            {s.student_id}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </Field>

          <Field label="Academic Year" required>
            <input
              required
              style={inputCss}
              value={form.academic_year}
              onChange={(e) =>
                setForm((f) => ({ ...f, academic_year: e.target.value }))
              }
            />
          </Field>

          <Field label="Term" required>
            <select
              required
              style={selectCss}
              value={form.term}
              onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create Registration"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
