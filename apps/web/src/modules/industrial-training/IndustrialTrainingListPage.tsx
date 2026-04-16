import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listIndustrialTraining } from "./industrial-training.api";
import type { TrainingStatus } from "./industrial-training.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  Pagination,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

const STATUSES: TrainingStatus[] = ["scheduled", "active", "completed", "cancelled"];

type BadgeColor = "gray" | "blue" | "green" | "red";
const STATUS_BADGE: Record<TrainingStatus, BadgeColor> = {
  scheduled: "gray",
  active: "blue",
  completed: "green",
  cancelled: "red",
};

export function IndustrialTrainingListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const page = Number(params.get("page") ?? "1");

  function set(key: string, value: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set(key, value);
      n.set("page", "1");
      return n;
    });
  }

  function setPage(v: number) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("page", String(v));
      return n;
    });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "industrialTraining",
      { status: status || undefined, page },
    ],
    queryFn: () =>
      listIndustrialTraining({
        status: (status as TrainingStatus) || undefined,
        page,
      }),
  });

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Industrial Training"
        action={
          <PrimaryBtn onClick={() => navigate("/industrial-training/new")}>
            + New Record
          </PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load industrial training records." />}

      <FilterBar>
        <select
          value={status}
          onChange={(e) => set("status", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={["Student", "Company", "Department", "Dates", "Status"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="🏗️"
        emptyTitle="No industrial training records"
        emptyDescription="Assign students to industrial training placements."
        colCount={5}
      >
        {(data ?? []).map((it) => (
          <TR
            key={it.id}
            onClick={() => navigate(`/industrial-training/${it.id}`)}
            clickable
          >
            <TD>
              {it.first_name || it.last_name ? (
                <span style={{ fontWeight: 500 }}>
                  {it.first_name} {it.last_name}
                </span>
              ) : (
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {it.student_id}
                </span>
              )}
            </TD>
            <TD>{it.company}</TD>
            <TD muted>{it.department ?? "—"}</TD>
            <TD muted>
              {it.start_date
                ? `${it.start_date}${it.end_date ? ` → ${it.end_date}` : ""}`
                : "—"}
            </TD>
            <TD>
              <Badge label={it.status} color={STATUS_BADGE[it.status]} />
            </TD>
          </TR>
        ))}
      </DataTable>

      {(data?.length ?? 0) === 20 && (
        <Pagination page={page} onPageChange={setPage} />
      )}
    </div>
  );
}
