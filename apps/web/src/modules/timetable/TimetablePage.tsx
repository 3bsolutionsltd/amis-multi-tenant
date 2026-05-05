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
import { listAcademicYears, listTerms } from "../academic-calendar/academic-calendar.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listCourses } from "../courses/courses.api";

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

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
  });

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const selectedYear = academicYears.find((y) => y.name === form.academic_year);

  const { data: terms = [] } = useQuery({
    queryKey: ["terms", selectedYear?.id],
    queryFn: () => listTerms({ academic_year_id: selectedYear?.id }),
    enabled: !!selectedYear,
  });

  const selectedProgramme = programmes.find((p) => p.code === form.programme);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", selectedProgramme?.id],
    queryFn: () => listCourses({ programme_id: selectedProgramme?.id }),
    enabled: !!selectedProgramme,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Programme">
          <select
            style={selectCss}
            value={form.programme ?? ""}
            onChange={(e) => {
              set("programme", e.target.value);
              set("course_id", "");
            }}
          >
            <option value="">— Select —</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.code}>{p.code} — {p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Academic Year">
          <select
            style={selectCss}
            value={form.academic_year ?? ""}
            onChange={(e) => set("academic_year", e.target.value)}
          >
            <option value="">— Select year —</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Course ID *">
          <select
            style={selectCss}
            required
            value={form.course_id}
            onChange={(e) => set("course_id", e.target.value)}
          >
            <option value="">— Select course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
            ))}
          </select>
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
            {terms.map((t) => (
              <option key={t.id} value={t.term_number}>{t.name}</option>
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
  const [filterYearId, setFilterYearId] = useState<string | undefined>();

  // Modal state
  const [modalSlot, setModalSlot] = useState<TimetableSlot | null>(null); // editing existing
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const { data: filterAcademicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
  });

  const { data: filterProgrammes = [] } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const { data: filterTerms = [] } = useQuery({
    queryKey: ["terms", filterYearId],
    queryFn: () => listTerms({ academic_year_id: filterYearId }),
    enabled: !!filterYearId,
  });

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
          <select
            style={selectCss}
            value={filters.programme ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, programme: e.target.value }))
            }
          >
            <option value="">All Programmes</option>
            {filterProgrammes.map((p) => (
              <option key={p.id} value={p.code}>{p.code} — {p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Academic Year">
          <select
            style={selectCss}
            value={filters.academic_year ?? ""}
            onChange={(e) => {
              const name = e.target.value;
              const yr = filterAcademicYears.find((y) => y.name === name);
              setFilterYearId(yr?.id);
              setFilters((f) => ({ ...f, academic_year: name, term_number: undefined }));
            }}
          >
            <option value="">All Years</option>
            {filterAcademicYears.map((y) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Term">
          <select
            style={selectCss}
            value={filters.term_number ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                term_number: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">All Terms</option>
            {filterTerms.map((t) => (
              <option key={t.id} value={t.term_number}>{t.name}</option>
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
              setFilterYearId(undefined);
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
