import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createFieldPlacement } from "./field-placements.api";
import type { PlacementStatus, PlacementType } from "./field-placements.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
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

interface FormState {
  student_id: string;
  host_organisation: string;
  supervisor: string;
  placement_type: PlacementType;
  start_date: string;
  end_date: string;
  status: PlacementStatus;
  notes: string;
}

export function FieldPlacementCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    student_id: "",
    host_organisation: "",
    supervisor: "",
    placement_type: "field",
    start_date: "",
    end_date: "",
    status: "scheduled",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      createFieldPlacement({
        student_id: form.student_id.trim(),
        host_organisation: form.host_organisation.trim(),
        supervisor: form.supervisor.trim() || undefined,
        placement_type: form.placement_type,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (created) => {
      navigate(`/field-placements/${created.id}`);
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : "Failed to create placement"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.student_id.trim()) {
      setFormError("Student ID is required.");
      return;
    }
    if (!form.host_organisation.trim()) {
      setFormError("Host organisation is required.");
      return;
    }
    createMut.mutate();
  }

  return (
    <div>
      <PageHeader
        title="New Field Placement"
        back={{ label: "Field Placements", to: "/field-placements" }}
      />

      <Card padding="20px 24px" style={{ maxWidth: 600 }}>
        <SectionLabel>Placement Details</SectionLabel>
        {formError && <ErrorBanner message={formError} />}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <Field label="Student ID" required>
            <input
              style={inputCss}
              placeholder="e.g. STU-001"
              value={form.student_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, student_id: e.target.value }))
              }
            />
          </Field>

          <Field label="Host Organisation" required>
            <input
              style={inputCss}
              placeholder="e.g. Regional Hospital"
              value={form.host_organisation}
              onChange={(e) =>
                setForm((f) => ({ ...f, host_organisation: e.target.value }))
              }
            />
          </Field>

          <Field label="Placement Type">
            <select
              style={inputCss}
              value={form.placement_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  placement_type: e.target.value as PlacementType,
                }))
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
              placeholder="Supervisor name"
              value={form.supervisor}
              onChange={(e) =>
                setForm((f) => ({ ...f, supervisor: e.target.value }))
              }
            />
          </Field>

          <Field label="Start Date">
            <input
              type="date"
              style={inputCss}
              value={form.start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_date: e.target.value }))
              }
            />
          </Field>

          <Field label="End Date">
            <input
              type="date"
              style={inputCss}
              value={form.end_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, end_date: e.target.value }))
              }
            />
          </Field>

          <Field label="Status">
            <select
              style={inputCss}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as PlacementStatus,
                }))
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
              placeholder="Additional notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <PrimaryBtn type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create Placement"}
            </PrimaryBtn>
            <SecondaryBtn
              type="button"
              onClick={() => navigate("/field-placements")}
            >
              Cancel
            </SecondaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
