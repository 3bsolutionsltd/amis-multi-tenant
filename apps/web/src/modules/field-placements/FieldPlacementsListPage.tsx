import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listFieldPlacements } from "./field-placements.api";
import type { PlacementStatus, PlacementType } from "./field-placements.api";
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

const STATUSES: PlacementStatus[] = ["scheduled", "active", "completed", "cancelled"];
const TYPES: PlacementType[] = ["field", "clinical", "community", "industry"];

type BadgeColor = "gray" | "blue" | "green" | "red";
const STATUS_BADGE: Record<PlacementStatus, BadgeColor> = {
  scheduled: "gray",
  active: "blue",
  completed: "green",
  cancelled: "red",
};

export function FieldPlacementsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const placement_type = params.get("placement_type") ?? "";
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
      "fieldPlacements",
      { status: status || undefined, placement_type: placement_type || undefined, page },
    ],
    queryFn: () =>
      listFieldPlacements({
        status: (status as PlacementStatus) || undefined,
        placement_type: (placement_type as PlacementType) || undefined,
        page,
      }),
  });

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Field Placements"
        action={
          <PrimaryBtn onClick={() => navigate("/field-placements/new")}>
            + New Placement
          </PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load field placements." />}

      <FilterBar>
        <select
          value={placement_type}
          onChange={(e) => set("placement_type", e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All Types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
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
        headers={["Student", "Host Organisation", "Type", "Dates", "Status"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="🗺️"
        emptyTitle="No field placements"
        emptyDescription="Assign students to field or clinical placements."
        colCount={5}
      >
        {(data ?? []).map((fp) => (
          <TR
            key={fp.id}
            onClick={() => navigate(`/field-placements/${fp.id}`)}
            clickable
          >
            <TD>
              {fp.first_name || fp.last_name ? (
                <span style={{ fontWeight: 500 }}>
                  {fp.first_name} {fp.last_name}
                </span>
              ) : (
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {fp.student_id}
                </span>
              )}
            </TD>
            <TD>{fp.host_organisation}</TD>
            <TD muted>
              <span
                style={{
                  textTransform: "capitalize",
                  fontSize: 13,
                }}
              >
                {fp.placement_type}
              </span>
            </TD>
            <TD muted>
              {fp.start_date
                ? `${fp.start_date}${fp.end_date ? ` → ${fp.end_date}` : ""}`
                : "—"}
            </TD>
            <TD>
              <Badge label={fp.status} color={STATUS_BADGE[fp.status]} />
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
