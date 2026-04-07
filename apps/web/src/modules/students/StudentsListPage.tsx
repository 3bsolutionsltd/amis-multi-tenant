import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { listStudents } from "./students.api";

export function StudentsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: students,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["students", { search, page }],
    queryFn: () => listStudents({ search: search || undefined, page }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error)
    return (
      <p style={{ color: "red" }}>
        Failed to load students. Is there a published config for this tenant?
      </p>
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Students</h2>
        <Link to="/students/new">
          <button
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
            + New Student
          </button>
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        style={{
          padding: "8px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          fontSize: 14,
          width: "100%",
          maxWidth: 360,
          boxSizing: "border-box",
          marginBottom: 16,
        }}
      />

      {students?.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          {search
            ? "No students match your search."
            : 'No students yet. Click "+ New Student" to add one.'}
        </p>
      ) : (
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr>
              {["First Name", "Last Name", "Date of Birth", "Created"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      borderBottom: "2px solid #e5e7eb",
                      padding: "8px 12px",
                      color: "#374151",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {students?.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/students/${s.id}`)}
                style={{
                  borderBottom: "1px solid #f3f4f6",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "#f9fafb")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "")
                }
              >
                <td style={{ padding: "10px 12px" }}>{s.first_name}</td>
                <td style={{ padding: "10px 12px" }}>{s.last_name}</td>
                <td style={{ padding: "10px 12px" }}>
                  {s.date_of_birth ?? "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}
      >
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: "6px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: page === 1 ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: page === 1 ? 0.5 : 1,
          }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(students?.length ?? 0) < 20}
          style={{
            padding: "6px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: (students?.length ?? 0) < 20 ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: (students?.length ?? 0) < 20 ? 0.5 : 1,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
