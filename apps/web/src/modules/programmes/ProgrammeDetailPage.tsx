import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProgramme, updateProgramme, deleteProgramme, type UpdateProgrammeBody } from "./programmes.api";
import { listCourses, createCourse, deleteCourse, updateCourse, type CreateCourseBody, type UpdateCourseBody, type Course } from "../courses/courses.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

const PROGRAMME_LEVELS = [
  "Certificate",
  "National Certificate",
  "National Diploma",
  "Higher National Diploma",
  "Diploma",
  "Bachelor's Degree",
] as const;

const FALLBACK_DEPARTMENTS = [
  "ICT", "Business", "Engineering", "Education", "Health Sciences",
  "Agriculture", "Social Sciences", "Hospitality", "Construction",
  "Automotive", "Electrical", "Others",
];

export function ProgrammeDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { departments } = useConfig();
  const deptOptions = departments.length > 0 ? departments : FALLBACK_DEPARTMENTS;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    department: "",
    duration_months: "",
    duration_unit: "months" as "months" | "years",
    level: "",
  });

  // Courses sub-section state
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState<{
    code: string; title: string; credit_hours: string;
    course_type: "theory" | "practical" | "both"; year_of_study: string; semester: string;
  }>({ code: "", title: "", credit_hours: "3", course_type: "theory", year_of_study: "1", semester: "1" });
  const [courseError, setCourseError] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseForm, setEditCourseForm] = useState<{
    code: string; title: string; credit_hours: string;
    course_type: "theory" | "practical" | "both"; year_of_study: string; semester: string;
  }>({ code: "", title: "", credit_hours: "3", course_type: "theory", year_of_study: "1", semester: "1" });

  const { data: programme, isLoading, error } = useQuery({
    queryKey: ["programmes", id],
    queryFn: () => getProgramme(id!),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: (body: UpdateProgrammeBody) => updateProgramme(id!, body),
    onSuccess: (updated) => {
      qc.setQueryData(["programmes", id], updated);
      qc.invalidateQueries({ queryKey: ["programmes"] });
      setEditing(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deleteProgramme(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programmes"] });
      navigate("/programmes");
    },
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", id],
    queryFn: () => listCourses({ programme_id: id! }),
    enabled: !!id,
  });

  const addCourseMutation = useMutation({
    mutationFn: (body: CreateCourseBody) => createCourse(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses", id] });
      setAddingCourse(false);
      setCourseForm({ code: "", title: "", credit_hours: "3", course_type: "theory", year_of_study: "1", semester: "1" });
      setCourseError(null);
    },
    onError: (err: Error) => setCourseError(err.message),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses", id] }),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ courseId, body }: { courseId: string; body: UpdateCourseBody }) => updateCourse(courseId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses", id] });
      setEditingCourseId(null);
      setCourseError(null);
    },
    onError: (err: Error) => setCourseError(err.message),
  });

  function startEditCourse(course: Course) {
    setEditingCourseId(course.id);
    setEditCourseForm({
      code: course.code,
      title: course.title,
      credit_hours: course.credit_hours != null ? String(course.credit_hours) : "3",
      course_type: course.course_type ?? "theory",
      year_of_study: course.year_of_study != null ? String(course.year_of_study) : "1",
      semester: course.semester != null ? String(course.semester) : "1",
    });
  }

  function startEdit() {
    setForm({
      code: programme!.code,
      title: programme!.title,
      department: programme!.department ?? "",
      duration_months: programme!.duration_months != null ? String(programme!.duration_months) : "",
      duration_unit: programme!.duration_unit ?? "months",
      level: programme!.level ?? "",
    });
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateProgrammeBody = {
      code: form.code,
      title: form.title,
      department: form.department || undefined,
      duration_months: form.duration_months ? Number(form.duration_months) : undefined,
      duration_unit: form.duration_unit,
      level: form.level || undefined,
    };
    saveMutation.mutate(body);
  }

  if (isLoading) return <Spinner />;
  if (error || !programme) return <ErrorBanner message="Programme not found." />;

  return (
    <div>
      <PageHeader
        title={`${programme.code} — ${programme.title}`}
        back={{ label: "Programmes", to: "/programmes" }}
        action={
          !editing ? (
            <div style={{ display: "flex", gap: 10 }}>
              <SecondaryBtn onClick={startEdit}>Edit</SecondaryBtn>
              {programme.is_active && (
                <button
                  onClick={() => {
                    if (confirm(`Deactivate "${programme.code}"?`)) deactivateMutation.mutate();
                  }}
                  style={{
                    padding: "7px 14px", fontSize: 13, borderRadius: 6,
                    border: "1px solid #fca5a5", background: "#fff", color: C.red, cursor: "pointer",
                  }}
                >
                  Deactivate
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {editing ? (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>Edit Programme</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Code" required>
                <input required style={inputCss} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </Field>
              <Field label="Level">
                <select style={selectCss} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
                  <option value="">— Select level —</option>
                  {PROGRAMME_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Title" required>
              <input required style={inputCss} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Department">
                <select style={selectCss} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                  <option value="">— Select department —</option>
                  {deptOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration">
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" min={1} style={{ ...inputCss, flex: 1 }} value={form.duration_months} onChange={(e) => setForm((f) => ({ ...f, duration_months: e.target.value }))} />
                  <select style={{ width: 90 }} value={form.duration_unit} onChange={(e) => setForm((f) => ({ ...f, duration_unit: e.target.value as "months" | "years" }))}>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </Field>
            </div>
            {saveMutation.isError && <ErrorBanner message="Failed to save." />}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <PrimaryBtn type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
            </div>
          </form>
        </Card>
      ) : (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <SectionLabel>Details</SectionLabel>
          <DetailRow label="Code">{programme.code}</DetailRow>
          <DetailRow label="Title">{programme.title}</DetailRow>
          <DetailRow label="Department">{programme.department ?? "—"}</DetailRow>
          <DetailRow label="Duration">{programme.duration_months != null ? `${programme.duration_months} ${programme.duration_unit === "years" ? (programme.duration_months === 1 ? "Year" : "Years") : (programme.duration_months === 1 ? "Month" : "Months")}` : "—"}</DetailRow>
          <DetailRow label="Level">{programme.level ?? "—"}</DetailRow>
          <DetailRow label="Status">
            <Badge label={programme.is_active ? "Active" : "Inactive"} color={programme.is_active ? "green" : "gray"} />
          </DetailRow>
          <DetailRow label="Created">{new Date(programme.created_at).toLocaleDateString()}</DetailRow>
        </Card>
      )}

      {/* ── Courses Section ── */}
      <div style={{ marginTop: 28, maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
            Courses ({courses.length})
          </h2>
          {!addingCourse && (
            <SecondaryBtn onClick={() => setAddingCourse(true)}>+ Add Course</SecondaryBtn>
          )}
        </div>

        {addingCourse && (
          <Card padding="20px" style={{ marginBottom: 16, border: `1px solid ${C.border}` }}>
            <SectionLabel>New Course</SectionLabel>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCourseMutation.mutate({
                  programme_id: id!,
                  code: courseForm.code,
                  title: courseForm.title,
                  credit_hours: Number(courseForm.credit_hours),
                  course_type: courseForm.course_type,
                  year_of_study: Number(courseForm.year_of_study),
                  semester: Number(courseForm.semester),
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <Field label="Code" required>
                  <input required style={inputCss} placeholder="e.g. BCM101" value={courseForm.code}
                    onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))} />
                </Field>
                <Field label="Title" required>
                  <input required style={inputCss} placeholder="e.g. Introduction to Computing" value={courseForm.title}
                    onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <Field label="Credit Hours">
                  <input type="number" min={1} max={10} style={inputCss} value={courseForm.credit_hours}
                    onChange={(e) => setCourseForm((f) => ({ ...f, credit_hours: e.target.value }))} />
                </Field>
                <Field label="Type">
                  <select style={selectCss} value={courseForm.course_type}
                    onChange={(e) => setCourseForm((f) => ({ ...f, course_type: e.target.value as typeof f.course_type }))}>
                    <option value="theory">Theory</option>
                    <option value="practical">Practical</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
                <Field label="Year">
                  <input type="number" min={1} max={6} style={inputCss} value={courseForm.year_of_study}
                    onChange={(e) => setCourseForm((f) => ({ ...f, year_of_study: e.target.value }))} />
                </Field>
                <Field label="Semester">
                  <input type="number" min={1} max={3} style={inputCss} value={courseForm.semester}
                    onChange={(e) => setCourseForm((f) => ({ ...f, semester: e.target.value }))} />
                </Field>
              </div>
              {courseError && <ErrorBanner message={courseError} />}
              <div style={{ display: "flex", gap: 10 }}>
                <PrimaryBtn type="submit" disabled={addCourseMutation.isPending}>
                  {addCourseMutation.isPending ? "Adding…" : "Add Course"}
                </PrimaryBtn>
                <SecondaryBtn type="button" onClick={() => { setAddingCourse(false); setCourseError(null); }}>Cancel</SecondaryBtn>
              </div>
            </form>
          </Card>
        )}

        {coursesLoading ? (
          <Spinner />
        ) : courses.length === 0 ? (
          <p style={{ color: C.textSecondary, fontSize: 13, margin: 0 }}>
            No courses yet. Click "+ Add Course" to add the first one.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: `1px solid ${C.border}` }}>
                {["Code", "Title", "Yr", "Sem", "Credits", "Type", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSecondary, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) =>
                editingCourseId === course.id ? (
                  <tr key={course.id} style={{ borderBottom: `1px solid ${C.border}`, background: "#f0f9ff" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <input style={{ ...inputCss, width: 80 }} value={editCourseForm.code}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, code: e.target.value }))} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input style={inputCss} value={editCourseForm.title}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, title: e.target.value }))} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input type="number" min={1} max={6} style={{ ...inputCss, width: 52 }} value={editCourseForm.year_of_study}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, year_of_study: e.target.value }))} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input type="number" min={1} max={3} style={{ ...inputCss, width: 52 }} value={editCourseForm.semester}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, semester: e.target.value }))} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input type="number" min={1} max={10} style={{ ...inputCss, width: 60 }} value={editCourseForm.credit_hours}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, credit_hours: e.target.value }))} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select style={selectCss} value={editCourseForm.course_type}
                        onChange={(e) => setEditCourseForm((f) => ({ ...f, course_type: e.target.value as typeof f.course_type }))}>
                        <option value="theory">Theory</option>
                        <option value="practical">Practical</option>
                        <option value="both">Both</option>
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => updateCourseMutation.mutate({
                          courseId: course.id,
                          body: {
                            code: editCourseForm.code,
                            title: editCourseForm.title,
                            credit_hours: Number(editCourseForm.credit_hours),
                            course_type: editCourseForm.course_type,
                            year_of_study: Number(editCourseForm.year_of_study),
                            semester: Number(editCourseForm.semester),
                          },
                        })}
                        disabled={updateCourseMutation.isPending}
                        style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 12, padding: "2px 6px", fontWeight: 600 }}
                      >
                        {updateCourseMutation.isPending ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingCourseId(null); setCourseError(null); }}
                        style={{ background: "none", border: "none", color: C.textSecondary, cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={course.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: C.primary }}>{course.code}</td>
                    <td style={{ padding: "8px 10px" }}>{course.title}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{course.year_of_study}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{course.semester}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{course.credit_hours}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <Badge
                        label={course.course_type ?? "theory"}
                        color={course.course_type === "practical" ? "blue" : course.course_type === "both" ? "purple" : "gray"}
                      />
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => startEditCourse(course)}
                        style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
                        title="Edit course"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove "${course.code}"?`)) deleteCourseMutation.mutate(course.id); }}
                        style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
                        title="Remove course"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
