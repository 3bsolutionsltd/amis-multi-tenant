import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { recordFeeEntry } from "./fees.api";
import { listStudents, type Student } from "../students/students.api";
import { useConfig } from "../../app/ConfigProvider";

export function FeeEntryPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    amount: "",
    reference: "",
    paid_at: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["students-search", search],
    queryFn: () => listStudents({ search: search || undefined }),
    enabled: search.length >= 2,
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function selectStudent(student: Student) {
    setSelectedStudent(student);
    setSearch(`${student.first_name} ${student.last_name}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
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
      setForm({
        amount: "",
        reference: "",
        paid_at: new Date().toISOString().slice(0, 10),
      });
      setSelectedStudent(null);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate("/finance")}
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
        <h2 style={{ margin: 0 }}>Record Payment</h2>
      </div>

      {success && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 6,
            padding: "12px 16px",
            color: "#16a34a",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          Payment recorded successfully.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Student picker */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <label style={labelStyle}>Student *</label>
          <input
            required
            placeholder="Search by name (min 2 chars)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedStudent) setSelectedStudent(null);
            }}
            style={fieldStyle}
          />
          {selectedStudent && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              Selected: {selectedStudent.first_name} {selectedStudent.last_name}
            </div>
          )}
          {students && !selectedStudent && students.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 100,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {students.map((student) => (
                <div
                  key={student.id}
                  onClick={() => selectStudent(student)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "")
                  }
                >
                  {student.first_name} {student.last_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Amount (UGX) *</label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Reference *</label>
          <input
            required
            value={form.reference}
            onChange={(e) => set("reference", e.target.value)}
            placeholder="Receipt / bank ref"
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Payment Date *</label>
          <input
            required
            type="date"
            value={form.paid_at}
            onChange={(e) => set("paid_at", e.target.value)}
            style={fieldStyle}
          />
        </div>

        {error && (
          <p
            style={{
              color: "#dc2626",
              backgroundColor: "#fef2f2",
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !selectedStudent}
          style={{
            backgroundColor: primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            cursor: saving || !selectedStudent ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 15,
            opacity: saving || !selectedStudent ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Record Payment"}
        </button>
      </form>
    </div>
  );
}
