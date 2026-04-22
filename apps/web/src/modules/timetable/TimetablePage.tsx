import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Card,
  FilterBar,
  Field,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  ErrorBanner,
  Spinner,
  EmptyState,
  Modal,
  C,
  inputCss,
  selectCss,
} from "../../lib/ui";
import {
  getTimetable,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  DAYS_OF_WEEK,
  type TimetableSlot,
  type TimetableSlotInput,
  type DayOfWeek,
  type TimetableFilters,
} from "./timetable.api";

// ─── Slot colour palette (cycle by course) ───────────────────────────────────
const SLOT_COLORS = [
  { bg: C.blueBg,   border: C.blue,   text: C.blueText },
  { bg: C.greenBg,  border: C.green,  text: C.greenText },
  { bg: C.purpleBg, border: C.purple, text: C.purpleText },
  { bg: C.yellowBg, border: C.yellow, text: C.yellowText },
  { bg: C.cyanBg,   border: C.cyan,   text: C.cyanText },
  { bg: C.pinkBg,   border: C.pink,   text: C.pinkText },
  { bg: C.indigoBg, border: C.indigo, text: C.indigoText },
];

function courseColor(courseId: string) {
  let hash = 0;
  for (const ch of courseId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return SLOT_COLORS[hash % SLOT_COLORS.length];
}

// ─── Empty slot form ──────────────────────────────────────────────────────────
const EMPTY_FORM: TimetableSlotInput = {
  day_of_week: "Monday",
  start_time: "08:00",
  end_time: "10:00",
  course_id: "",
  programme: "",
  academic_year: "",
  room: "",
  instructor_name: "",
  notes: "",
};

// ─── SlotCard ─────────────────────────────────────────────────────────────────
function SlotCard({
  slot,
  onEdit,
  onDelete,
}: {
  slot: TimetableSlot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const col = courseColor(slot.course_id);
  return (
    <div
      style={{
        background: col.bg,
        border: `1px solid ${col.border}`,
        borderRadius: 6,
        padding: "6px 9px",
        marginBottom: 6,
        cursor: "pointer",
        position: "relative",
      }}
      onClick={onEdit}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: col.text }}>
        {slot.course_id}
      </div>
      <div style={{ fontSize: 12, color: C.gray700 }}>
        {slot.start_time}–{slot.end_time}
      </div>
      {slot.room && (
        <div style={{ fontSize: 11, color: C.gray500 }}>📍 {slot.room}</div>
      )}
      {slot.instructor_name && (
        <div style={{ fontSize: 11, color: C.gray500 }}>
          👤 {slot.instructor_name}
        </div>
      )}
      <button
        title="Delete slot"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: 4,
          right: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: C.gray400,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── SlotForm (inside Modal) ──────────────────────────────────────────────────
function SlotForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: TimetableSlotInput;
  onSave: (v: TimetableSlotInput) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  const [form, setForm] = useState<TimetableSlotInput>(initial);
  const set = (k: keyof TimetableSlotInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Course ID *">
          <input
            style={inputCss}
            required
            value={form.course_id}
            onChange={(e) => set("course_id", e.target.value)}
            placeholder="e.g. CSC101"
          />
        </Field>
        <Field label="Day *">
          <select
            style={selectCss}
            value={form.day_of_week}
            onChange={(e) => set("day_of_week", e.target.value as DayOfWeek)}
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Start Time *">
          <input
            type="time"
            style={inputCss}
            required
            value={form.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </Field>
        <Field label="End Time *">
          <input
            type="time"
            style={inputCss}
            required
            value={form.end_time}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </Field>
        <Field label="Room">
          <input
            style={inputCss}
            value={form.room ?? ""}
            onChange={(e) => set("room", e.target.value)}
            placeholder="e.g. LT-1"
          />
        </Field>
        <Field label="Instructor">
          <input
            style={inputCss}
            value={form.instructor_name ?? ""}
            onChange={(e) => set("instructor_name", e.target.value)}
            placeholder="Name"
          />
        </Field>
        <Field label="Programme">
          <input
            style={inputCss}
            value={form.programme ?? ""}
            onChange={(e) => set("programme", e.target.value)}
            placeholder="e.g. BCS"
          />
        </Field>
        <Field label="Academic Year">
          <input
            style={inputCss}
            value={form.academic_year ?? ""}
            onChange={(e) => set("academic_year", e.target.value)}
            placeholder="e.g. 2025/2026"
          />
        </Field>
        <Field label="Term">
          <select
            style={selectCss}
            value={form.term_number ?? ""}
            onChange={(e) =>
              set(
                "term_number",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          >
            <option value="">— any —</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>Term {n}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
          <input
            style={inputCss}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes"
          />
        </Field>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <SecondaryBtn type="button" onClick={onCancel}>
          Cancel
        </SecondaryBtn>
        <PrimaryBtn type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Slot"}
        </PrimaryBtn>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function TimetablePage() {
  const qc = useQueryClient();

  const [filters, setFilters] = useState<TimetableFilters>({});
  const [applied, setApplied] = useState<TimetableFilters>({});

  // Modal state
  const [modalSlot, setModalSlot] = useState<TimetableSlot | null>(null); // editing existing
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const { data: slots = [], isLoading, error } = useQuery({
    queryKey: ["timetable", applied],
    queryFn: () => getTimetable(applied),
  });

  const createMut = useMutation({
    mutationFn: createTimetableSlot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      setModalOpen(false);
      setModalSlot(null);
    },
    onError: (e) => setFormError(String(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TimetableSlotInput> }) =>
      updateTimetableSlot(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      setModalOpen(false);
      setModalSlot(null);
    },
    onError: (e) => setFormError(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTimetableSlot,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable"] }),
  });

  function openNew() {
    setModalSlot(null);
    setFormError(undefined);
    setModalOpen(true);
  }

  function openEdit(slot: TimetableSlot) {
    setModalSlot(slot);
    setFormError(undefined);
    setModalOpen(true);
  }

  function handleSave(v: TimetableSlotInput) {
    setFormError(undefined);
    const clean = {
      ...v,
      programme: v.programme || undefined,
      academic_year: v.academic_year || undefined,
      room: v.room || undefined,
      instructor_name: v.instructor_name || undefined,
      notes: v.notes || undefined,
    };
    if (modalSlot) {
      updateMut.mutate({ id: modalSlot.id, body: clean });
    } else {
      createMut.mutate(clean);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this slot?")) return;
    deleteMut.mutate(id);
  }

  // Group slots by day
  const byDay: Record<DayOfWeek, TimetableSlot[]> = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [],
  };
  for (const s of slots) {
    byDay[s.day_of_week].push(s);
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="Weekly schedule for programmes and courses"
        action={
          <PrimaryBtn onClick={openNew}>+ New Slot</PrimaryBtn>
        }
      />

      <FilterBar>
        <Field label="Programme">
          <input
            style={inputCss}
            placeholder="e.g. BCS"
            value={filters.programme ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, programme: e.target.value }))
            }
          />
        </Field>
        <Field label="Academic Year">
          <input
            style={inputCss}
            placeholder="e.g. 2025/2026"
            value={filters.academic_year ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, academic_year: e.target.value }))
            }
          />
        </Field>
        <Field label="Term">
          <select
            style={selectCss}
            value={filters.term_number ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                term_number: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              }))
            }
          >
            <option value="">All Terms</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>Term {n}</option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <PrimaryBtn onClick={() => setApplied({ ...filters })}>
            Filter
          </PrimaryBtn>
          <SecondaryBtn
            onClick={() => {
              setFilters({});
              setApplied({});
            }}
          >
            Reset
          </SecondaryBtn>
        </div>
      </FilterBar>

      {error && <ErrorBanner message={String(error)} />}
      {isLoading && (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spinner />
        </div>
      )}

      {!isLoading && slots.length === 0 && !error && (
        <div style={{ padding: 48 }}>
          <EmptyState
            message="No timetable slots found."
            description="Click '+ New Slot' to add a class to the schedule."
            action={<PrimaryBtn onClick={openNew}>+ New Slot</PrimaryBtn>}
          />
        </div>
      )}

      {!isLoading && slots.length > 0 && (
        <div style={{ padding: "0 24px 24px" }}>
          {/* Weekly grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 12,
            }}
          >
            {DAYS_OF_WEEK.map((day) => (
              <div key={day}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: C.gray700,
                    borderBottom: `2px solid ${C.primary}`,
                    paddingBottom: 6,
                    marginBottom: 10,
                    textAlign: "center",
                  }}
                >
                  {day}
                </div>
                {byDay[day].length === 0 ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.gray400,
                      textAlign: "center",
                      paddingTop: 12,
                    }}
                  >
                    —
                  </div>
                ) : (
                  byDay[day].map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      onEdit={() => openEdit(slot)}
                      onDelete={() => handleDelete(slot.id)}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary count */}
      {slots.length > 0 && (
        <div
          style={{
            padding: "0 24px 16px",
            fontSize: 13,
            color: C.gray500,
          }}
        >
          {slots.length} slot{slots.length !== 1 ? "s" : ""} total
        </div>
      )}

      {/* CRUD Modal */}
      {modalOpen && (
        <Modal
          title={modalSlot ? "Edit Timetable Slot" : "New Timetable Slot"}
          onClose={() => setModalOpen(false)}
        >
          <SlotForm
            initial={
              modalSlot
                ? {
                    day_of_week: modalSlot.day_of_week,
                    start_time: modalSlot.start_time.slice(0, 5),
                    end_time: modalSlot.end_time.slice(0, 5),
                    course_id: modalSlot.course_id,
                    programme: modalSlot.programme ?? "",
                    academic_year: modalSlot.academic_year ?? "",
                    room: modalSlot.room ?? "",
                    instructor_name: modalSlot.instructor_name ?? "",
                    notes: modalSlot.notes ?? "",
                    term_number: modalSlot.term_number ?? undefined,
                  }
                : EMPTY_FORM
            }
            onSave={handleSave}
            onCancel={() => setModalOpen(false)}
            saving={saving}
            error={formError}
          />
          {modalSlot && (
            <div style={{ borderTop: `1px solid ${C.gray200}`, paddingTop: 12, marginTop: 4 }}>
              <DangerBtn
                onClick={() => {
                  setModalOpen(false);
                  handleDelete(modalSlot.id);
                }}
              >
                Delete Slot
              </DangerBtn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
