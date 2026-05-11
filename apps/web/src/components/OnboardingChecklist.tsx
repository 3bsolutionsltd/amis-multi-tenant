import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { listStudents } from "../modules/students/students.api";
import { listProgrammes } from "../modules/programmes/programmes.api";

interface CheckItem {
  label: string;
  done: boolean;
  path?: string;
  loading?: boolean;
}

function CheckRow({ item }: { item: CheckItem }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => !item.done && item.path && navigate(item.path)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 8,
        cursor: !item.done && item.path ? "pointer" : "default",
        background: item.done ? "#f0fdf4" : "#fff",
        border: "1px solid",
        borderColor: item.done ? "#bbf7d0" : "#e5e7eb",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!item.done && item.path)
          (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        if (!item.done && item.path)
          (e.currentTarget as HTMLDivElement).style.background = "#fff";
      }}
    >
      {/* icon */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: item.done ? "#22c55e" : "#e5e7eb",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {item.loading ? "…" : item.done ? "✓" : "!"}
      </div>

      {/* label */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: item.done ? "#166534" : "#374151",
          flex: 1,
          textDecoration: item.done ? "line-through" : "none",
        }}
      >
        {item.label}
      </span>

      {/* action arrow */}
      {!item.done && item.path && (
        <span style={{ fontSize: 14, color: "#9ca3af" }}>→</span>
      )}
    </div>
  );
}

export function OnboardingChecklist() {
  const results = useQueries({
    queries: [
      {
        queryKey: ["onboard-academic-years"],
        queryFn: () => apiFetch<unknown[]>("/academic-years?limit=1"),
        staleTime: 30_000,
      },
      {
        queryKey: ["onboard-fee-structures"],
        queryFn: () => apiFetch<unknown[]>("/fee-structures?limit=1"),
        staleTime: 30_000,
      },
      {
        queryKey: ["onboard-grading-scales"],
        queryFn: () =>
          apiFetch<{ data?: unknown[] }>("/grading-scales?limit=1").then(
            (r) => (r as any).data ?? r,
          ),
        staleTime: 30_000,
      },
      {
        queryKey: ["onboard-programmes"],
        queryFn: () => listProgrammes(),
        staleTime: 30_000,
      },
      {
        queryKey: ["onboard-students"],
        queryFn: () => listStudents({ limit: 1 }),
        staleTime: 30_000,
      },
    ],
  });

  const [yearQ, feeQ, gradeQ, progQ, stuQ] = results;

  const items: CheckItem[] = [
    {
      label: "Institution registered",
      done: true,
    },
    {
      label: "Academic calendar created",
      done: (yearQ.data?.length ?? 0) > 0,
      path: "/admin-studio/academic-calendar",
      loading: yearQ.isLoading,
    },
    {
      label: "Fee structures defined",
      done: (feeQ.data?.length ?? 0) > 0,
      path: "/admin-studio/fee-structure",
      loading: feeQ.isLoading,
    },
    {
      label: "Grading scale defined",
      done: (gradeQ.data?.length ?? 0) > 0,
      path: "/admin-studio/grading",
      loading: gradeQ.isLoading,
    },
    {
      label: "First programme added",
      done: (progQ.data?.length ?? 0) > 0,
      path: "/admin-studio/programmes",
      loading: progQ.isLoading,
    },
    {
      label: "First student enrolled",
      done: (stuQ.data?.length ?? 0) > 0,
      path: "/students",
      loading: stuQ.isLoading,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const isComplete = completedCount === items.length;

  // Hide once everything is done
  if (isComplete) return null;

  const pct = Math.round((completedCount / items.length) * 100);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 24,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
            🚀 Set up your institution
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            {completedCount} of {items.length} steps complete
          </p>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#2563eb",
          }}
        >
          {pct}%
        </span>
      </div>

      {/* progress bar */}
      <div style={{ height: 6, borderRadius: 99, background: "#e5e7eb", marginBottom: 16 }}>
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            width: `${pct}%`,
            background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#3b82f6",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <CheckRow key={item.label} item={item} />
        ))}
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9ca3af" }}>
        Click any incomplete step to go there now. This widget hides once all steps are done.
      </p>
    </div>
  );
}
