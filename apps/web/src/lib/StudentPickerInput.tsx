import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listStudents } from "../modules/students/students.api";
import { C, inputCss } from "./ui";

interface Props {
  value: string;           // currently selected student_id
  displayName?: string;    // optional display name for the selected student
  onChange: (studentId: string, studentName: string) => void;
  error?: string;
  placeholder?: string;
}

/**
 * StudentPickerInput — searchable autocomplete for selecting a student.
 * Shows first_name + last_name in a dropdown, returns the student UUID.
 */
export function StudentPickerInput({
  value,
  displayName,
  onChange,
  error,
  placeholder = "Search by name or admission number…",
}: Props) {
  const [query, setQuery] = useState(displayName || "");
  const [open, setOpen] = useState(false);

  const { data: suggestions } = useQuery({
    queryKey: ["students-picker", query],
    queryFn: () => listStudents({ search: query, limit: 10 }),
    enabled: open && query.length >= 2,
    staleTime: 15_000,
  });

  function pick(id: string, name: string) {
    onChange(id, name);
    setQuery(name);
    setOpen(false);
  }

  function handleChange(v: string) {
    setQuery(v);
    setOpen(true);
    if (!v) onChange("", "");
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        style={{
          ...inputCss,
          borderColor: error ? C.red : undefined,
        }}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onChange={(e) => handleChange(e.target.value)}
      />
      {open && suggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: `1px solid ${C.gray200}`,
            borderRadius: 7,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            zIndex: 300,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s.id}
              onMouseDown={() =>
                pick(s.id, `${s.first_name} ${s.last_name}`)
              }
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: `1px solid ${C.gray100}`,
                fontSize: 13,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  C.gray50;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "#fff";
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {s.first_name} {s.last_name}
              </span>
              {s.admission_number && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: C.gray400,
                    fontFamily: "monospace",
                  }}
                >
                  {s.admission_number}
                </span>
              )}
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  color: C.gray400,
                  fontFamily: "monospace",
                  marginTop: 1,
                }}
              >
                {s.id}
              </span>
            </div>
          ))}
        </div>
      )}
      {value && (
        <div
          style={{
            fontSize: 10,
            color: C.gray400,
            fontFamily: "monospace",
            paddingTop: 2,
            paddingLeft: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          ID: {value}
        </div>
      )}
      {error && (
        <div style={{ color: C.red, fontSize: 12, marginTop: 2 }}>{error}</div>
      )}
    </div>
  );
}
