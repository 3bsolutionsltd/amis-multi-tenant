import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFieldPlacement,
  updateFieldPlacement,
} from "./field-placements.api";
import type { PlacementStatus, PlacementType } from "./field-placements.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Spinner,
  Field,
  inputCss,
} from "../../lib/ui";

const STATUSES: PlacementStatus[] = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
];

const TYPES: PlacementType[] = ["field", "clinical", "community", "industry"];

type BadgeColor = "gray" | "blue" | "green" | "red";
const STATUS_BADGE: Record<PlacementStatus, BadgeColor> = {
  scheduled: "gray",
  active: "blue",
  completed: "green",
  cancelled: "red",
};

export function FieldPlacementDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fieldPlacement", id],
    queryFn: () => getFieldPlacement(id!),
    enabled: !!id,
  });

  const [form, setForm] = useState<{
    host_organisation: string;
    supervisor: string;
    placement_type: PlacementType;
    start_date: string;
    end_date: string;
    status: PlacementStatus;
    notes: string;
  } | null>(null);

  function startEdit() {
    if (!data) return;
    setForm({
      host_organisation: data.host_organisation,
      supervisor: data.supervisor ?? "",
      placement_type: data.placement_type,
      start_date: data.start_date ?? "",
      end_date: data.end_date ?? "",
      status: data.status,
      notes: data.notes ?? "",
    });
    setEditing(true);
  }

  const patchMut = useMutation({
    mutationFn: () =>
      updateFieldPlacement(id!, {
        host_organisation: form!.host_organisation || undefined,
        supervisor: form!.supervisor || null,
        placement_type: form!.placement_type,
        start_date: form!.start_date || null,
        end_date: form!.end_date || null,
        status: form!.status,
        notes: form!.notes || null,
      }),
    onSuccess: () => {
      setPatchError(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["fieldPlacement", id] });
      qc.invalidateQueries({ queryKey: ["fieldPlacements"] });
    },
    onError: (err) =>
      setPatchError(err instanceof Error ? err.message : "Update failed"),
  });

  if (isLoading) return <Spinner />;
  if (!data)
    return (
      <div>
        <PageHeader
          title="Field Placement"
          back={{ label: "Field Placements", to: "/field-placements" }}
        />
        <ErrorBanner message="Record not found." />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={data.host_organisation}
        back={{ label: "Field Placements", to: "/field-placements" }}
        action={
          <Badge label={data.status} color={STATUS_BADGE[data.status]} />
        }
      />

      {!editing ? (
        <Card padding="0 24px" style={{ marginBottom: 20 }}>
          <DetailRow label="Student">
            {data.first_name || data.last_name
              ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
              : data.student_id}
          </DetailRow>
          <DetailRow label="Host Organisation">{data.host_organisation}</DetailRow>
          <DetailRow label="Type">
            <span style={{ textTransform: "capitalize" }}>{data.placement_type}</span>
          </DetailRow>
          <DetailRow label="Supervisor">{data.supervisor ?? "—"}</DetailRow>
          <DetailRow label="Start Date">{data.start_date ?? "—"}</DetailRow>
          <DetailRow label="End Date">{data.end_date ?? "—"}</DetailRow>
          <DetailRow label="Notes">{data.notes ?? "—"}</DetailRow>
          <DetailRow label="Created">
            {new Date(data.created_at).toLocaleString()}
          </DetailRow>
          <div style={{ padding: "16px 0" }}>
            <SecondaryBtn onClick={startEdit}>Edit</SecondaryBtn>
          </div>
        </Card>
      ) : (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <SectionLabel>Edit Placement Record</SectionLabel>
          {patchError && <ErrorBanner message={patchError} />}

          <Field label="Host Organisation" required>
            <input
              style={inputCss}
              value={form!.host_organisation}
              onChange={(e) =>
                setForm((f) => f && { ...f, host_organisation: e.target.value })
              }
            />
          </Field>
          <Field label="Placement Type">
            <select
              style={inputCss}
              value={form!.placement_type}
              onChange={(e) =>
                setForm((f) => f && { ...f, placement_type: e.target.value as PlacementType })
              }
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supervisor">
            <input
              style={inputCss}
              value={form!.supervisor}
              onChange={(e) =>
                setForm((f) => f && { ...f, supervisor: e.target.value })
              }
            />
          </Field>
          <Field label="Start Date">
            <input
              type="date"
              style={inputCss}
              value={form!.start_date}
              onChange={(e) =>
                setForm((f) => f && { ...f, start_date: e.target.value })
              }
            />
          </Field>
          <Field label="End Date">
            <input
              type="date"
              style={inputCss}
              value={form!.end_date}
              onChange={(e) =>
                setForm((f) => f && { ...f, end_date: e.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              style={inputCss}
              value={form!.status}
              onChange={(e) =>
                setForm((f) => f && { ...f, status: e.target.value as PlacementStatus })
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
              value={form!.notes}
              onChange={(e) =>
                setForm((f) => f && { ...f, notes: e.target.value })
              }
            />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <PrimaryBtn
              onClick={() => patchMut.mutate()}
              disabled={patchMut.isPending}
            >
              {patchMut.isPending ? "Saving…" : "Save Changes"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}
    </div>
  );
}
