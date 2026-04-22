import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { recordFeeEntry } from "./fees.api";
import { listStudents, type Student } from "../students/students.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FeeEntryPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillStudentId = searchParams.get("student_id") ?? undefined;
  const prefillStudentName = searchParams.get("student_name") ?? undefined;

  const [search, setSearch] = useState(prefillStudentName ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    prefillStudentId && prefillStudentName
      ? ({
          id: prefillStudentId,
          first_name: prefillStudentName,
          last_name: "",
        } as Student)
      : null,
  );
  const [form, setForm] = useState({
    amount: "",
    reference: "",
    paid_at: todayIso(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ["students-search-fee", search],
    queryFn: () => listStudents({ search, page: 1, per_page: 10 }),
    enabled: search.length >= 2,
  });

  function selectStudent(s: Student) {
    setSelectedStudent(s);
    setSearch(`${s.first_name} ${s.last_name}`);
    setShowDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) {
      setError("Please select a student");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await recordFeeEntry({
        student_id: selectedStudent.id,
        amount: Number(form.amount),
        reference: form.reference,
        paid_at: form.paid_at,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Record Payment"
        back={{ label: "Finance", to: "/finance" }}
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

          <Field label="Amount" required>
            <input
              required
              type="number"
              min={1}
              step="0.01"
              style={inputCss}
              value={form.amount}
              placeholder="0.00"
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </Field>

          <Field label="Reference" required>
            <input
              required
              style={inputCss}
              value={form.reference}
              placeholder="Receipt / bank ref"
              onChange={(e) =>
                setForm((f) => ({ ...f, reference: e.target.value }))
              }
            />
          </Field>

          <Field label="Payment Date" required>
            <input
              required
              type="date"
              style={inputCss}
              value={form.paid_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, paid_at: e.target.value }))
              }
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          {success && (
            <div
              style={{
                padding: "10px 14px",
                background: "#d1fae5",
                borderRadius: 6,
                color: "#065f46",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Payment recorded successfully.{" "}
              <button
                type="button"
                onClick={() =>
                  navigate(`/students/${selectedStudent!.id}`)
                }
                style={{
                  color: "#065f46",
                  fontWeight: 700,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: 13,
                }}
              >
                View student →
              </button>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Recording…" : "Record Payment"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
