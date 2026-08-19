import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAttendance,
  getAttendanceSummary,
  batchSaveAttendance,
  ATTENDANCE_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  type AttendanceStatus,
  type BatchAttendanceItem,
} from "./attendance.api";
import { listAcademicYears } from "../academic-calendar/academic-calendar.api";
import { listCourses } from "../courses/courses.api";
import { listProgrammes } from "../programmes/programmes.api";
import { listStudents } from "../students/students.api";
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
  selectCss,
  C,
} from "../../lib/ui";

type ViewMode = "sheet" | "summary";

export function AttendancePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  // All useState hooks must come first (before any queries or derived values)
  const [filters, setFilters] = useState({
    programme: "",
    academic_year: "",
    term_number: "",
    course_id: "",
    date: new Date().toISOString().slice(0, 10), // today
  });
  const [applied, setApplied] = useState({ ...filters });
  const [viewMode, setViewMode] = useState<ViewMode>("sheet");
  const [saved, setSaved] = useState(false);

  // Sheet state: map of student_id → {status, notes}
  const [sheet, setSheet] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears(),
  });

  const { data: programmesList = [] } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const selectedProgramme = programmesList.find((p) => p.code === filters.programme);

  const { data: coursesList = [] } = useQuery({
    queryKey: ["courses", selectedProgramme?.id],
    queryFn: () => listCourses({ programme_id: selectedProgramme?.id }),
  });

  const canQuery =
    !!applied.course_id && !!applied.date;

  const attendanceQuery = useQuery({
    queryKey: ["attendance", applied],
    queryFn: () =>
      getAttendance({
        course_id: applied.course_id || undefined,
        programme: applied.programme || undefined,
        academic_year: applied.academic_year || undefined,
        term_number: applied.term_number
          ? Number(applied.term_number)
          : undefined,
        date: applied.date || undefined,
      }),
    enabled: canQuery && viewMode === "sheet",
  });

  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", applied],
    queryFn: () =>
      getAttendanceSummary({
        programme: applied.programme || undefined,
        academic_year: applied.academic_year || undefined,
        term_number: applied.term_number
          ? Number(applied.term_number)
          : undefined,
        course_id: applied.course_id || undefined,
      }),
    enabled: viewMode === "summary",
  });

  // Full class roster for the selected programme — the attendance sheet must
  // show every enrolled student, not just students who already have an
  // attendance record for this exact date (otherwise a never-recorded
  // course/date shows an empty, apparently "unresponsive" sheet).
  // /students caps `limit` at 100 server-side, so page through all results.
  const rosterQuery = useQuery({
    queryKey: ["attendance-roster", applied.programme],
    queryFn: async () => {
      const pageSize = 100;
      const all = [];
      for (let page = 1; ; page++) {
        const batch = await listStudents({
          programme: applied.programme,
          limit: pageSize,
          page,
        });
        all.push(...batch);
        if (batch.length < pageSize) break;
      }
      return all;
    },
    enabled: canQuery && viewMode === "sheet" && !!applied.programme,
  });

  const batchMutation = useMutation({
    mutationFn: () => {
      const records: BatchAttendanceItem[] = Object.entries(sheet).map(
        ([student_id, val]) => ({
          student_id,
          status: val.status,
          notes: val.notes || undefined,
        })
      );
      return batchSaveAttendance({
        course_id: applied.course_id,
        programme: applied.programme || "N/A",
        academic_year: applied.academic_year || "",
        term_number: Number(applied.term_number) || 1,
        date: applied.date,
        records,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function applyFilters() {
    setApplied({ ...filters });
    setSheet({});
    setSaved(false);
  }

  function resetFilters() {
    const init = {
      programme: "",
      academic_year: "",
      term_number: "",
      course_id: "",
      date: new Date().toISOString().slice(0, 10),
    };
    setFilters(init);
    setApplied(init);
    setSheet({});
  }

  // Seed sheet from existing attendance data
  function seedSheet() {
    const records = attendanceQuery.data ?? [];
    const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
    for (const r of records) {
      map[r.student_id] = {
        status: r.status,
        notes: r.notes ?? "",
      };
    }
    setSheet(map);
  }

  const records = attendanceQuery.data ?? [];
  const summary = summaryQuery.data ?? [];

  // Class roster to display on the sheet: prefer the full enrolled roster
  // (by programme) so attendance can be taken even when no records exist yet
  // for this date; fall back to students who already have a record (e.g. no
  // programme resolved) so existing data is never hidden.
  const roster = rosterQuery.data ?? [];
  const students = roster.length > 0
    ? roster.map((s) => ({
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        admission_number: s.admission_number,
      }))
    : records.filter(
        (r, i, arr) =>
          arr.findIndex((x) => x.student_id === r.student_id) === i
      );
  const isRosterLoading = rosterQuery.isLoading && !!applied.programme;

  function getStatus(studentId: string): AttendanceStatus {
    return sheet[studentId]?.status ?? "present";
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSheet((s) => ({
      ...s,
      [studentId]: { status, notes: s[studentId]?.notes ?? "" },
    }));
  }

  function setNotes(studentId: string, notes: string) {
    setSheet((s) => ({
      ...s,
      [studentId]: { status: getStatus(studentId), notes },
    }));
  }

  const attendanceRate =
    summary.length > 0
      ? Math.round(
          (summary.reduce((acc, s) => acc + Number(s.present), 0) /
            summary.reduce((acc, s) => acc + Number(s.total), 0)) *
            100
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Record and review student attendance by course and date"
      />

      {/* Filter bar */}
      <Card padding="16px 20px" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Field label="Course *">
            <select
              style={selectCss}
              value={filters.course_id}
              onChange={(e) => {
                const course = coursesList.find((c) => c.id === e.target.value);
                const programme = programmesList.find((p) => p.id === course?.programme_id);
                setFilters({
                  ...filters,
                  course_id: e.target.value,
                  programme: programme?.code ?? filters.programme,
                });
              }}
            >
              <option value="">— Select course —</option>
              {coursesList.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Date *">
            <input
              type="date"
              style={inputCss}
              value={filters.date}
              onChange={(e) =>
                setFilters({ ...filters, date: e.target.value })
              }
            />
          </Field>
          <Field label="Programme">
            {programmesList.length > 0 ? (
              <select
                style={selectCss}
                value={filters.programme}
                onChange={(e) =>
                  setFilters({ ...filters, programme: e.target.value })
                }
              >
                <option value="">All programmes</option>
                {programmesList.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={inputCss}
                value={filters.programme}
                onChange={(e) =>
                  setFilters({ ...filters, programme: e.target.value })
                }
                placeholder="Programme"
              />
            )}
          </Field>
          <Field label="Academic Year">
            <select
              style={selectCss}
              value={filters.academic_year}
              onChange={(e) =>
                setFilters({ ...filters, academic_year: e.target.value })
              }
            >
              <option value="">All years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Term">
            <select
              style={selectCss}
              value={filters.term_number}
              onChange={(e) =>
                setFilters({ ...filters, term_number: e.target.value })
              }
            >
              <option value="">All terms</option>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
              <option value="4">Term 4</option>
            </select>
          </Field>
        </div>
        <p style={{ margin: "-4px 0 12px", fontSize: 12, color: C.gray500 }}>
          Select a programme first to narrow the course list, or select a course and its programme will be selected automatically. Existing attendance records are shown for the selected course and date; a blank result means no attendance has been recorded yet.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <PrimaryBtn onClick={applyFilters}>Apply</PrimaryBtn>
          <SecondaryBtn onClick={resetFilters}>Reset</SecondaryBtn>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {(["sheet", "summary"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${viewMode === m ? C.primary : C.gray200}`,
                  background: viewMode === m ? C.primary : "#fff",
                  color: viewMode === m ? "#fff" : C.gray700,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {m === "sheet" ? "📋 Sheet" : "📊 Summary"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Sheet view */}
      {viewMode === "sheet" && (
        <>
          {!canQuery ? (
            <Card padding="24px">
              <p style={{ fontSize: 14, color: C.gray500, margin: 0 }}>
                Enter a <strong>Course ID</strong> and <strong>Date</strong>{" "}
                then click Apply to load the attendance sheet.
              </p>
            </Card>
          ) : attendanceQuery.isLoading || isRosterLoading ? (
            <Card padding="16px 20px">
              <div
                style={{
                  height: 40,
                  borderRadius: 6,
                  background: C.gray100,
                  animation: "amis-pulse 1.5s ease-in-out infinite",
                }}
              />
            </Card>
          ) : attendanceQuery.isError ? (
            <ErrorBanner message="Failed to load attendance records." />
          ) : rosterQuery.isError ? (
            <ErrorBanner message="Failed to load the class roster." />
          ) : (
            <>
              {students.length === 0 ? (
                <Card padding="24px" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, color: C.gray500, margin: 0 }}>
                    No students found for this programme. Select a course whose
                    programme has enrolled students, or add students first.
                  </p>
                </Card>
              ) : records.length === 0 ? (
                <Card padding="24px" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, color: C.gray500, margin: 0 }}>
                    No existing records for this course &amp; date. Enter
                    attendance for the students below and click Save.
                  </p>
                </Card>
              ) : (
                <Card padding="16px 20px" style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, color: C.gray500 }}>
                      {records.length} student{records.length !== 1 ? "s" : ""}{" "}
                      found for{" "}
                      <strong>
                        {applied.course_id} on {applied.date}
                      </strong>
                    </span>
                    <SecondaryBtn onClick={seedSheet}>
                      Load existing
                    </SecondaryBtn>
                  </div>
                </Card>
              )}

              {students.length > 0 && (
                <>
                  <Card style={{ marginBottom: 16 }}>
                    {/* Header row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 160px 1fr",
                        gap: 8,
                        padding: "8px 20px",
                        background: C.gray50,
                        borderBottom: `1px solid ${C.gray100}`,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: C.gray500,
                      }}
                    >
                      <div>Student</div>
                      <div>Adm. No.</div>
                      <div>Status</div>
                      <div>Notes</div>
                    </div>
                    {students.map((r, i) => {
                      const status = getStatus(r.student_id);
                      return (
                        <div
                          key={r.student_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 160px 1fr",
                            gap: 8,
                            padding: "10px 20px",
                            alignItems: "center",
                            borderBottom:
                              i < students.length - 1
                                ? `1px solid ${C.gray100}`
                                : "none",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: C.gray900,
                            }}
                          >
                            {r.last_name}, {r.first_name}
                          </div>
                          <div style={{ fontSize: 13, color: C.gray500 }}>
                            {r.admission_number ?? "—"}
                          </div>
                          <div>
                            <select
                              style={{
                                ...selectCss,
                                color: STATUS_COLORS[status],
                                fontWeight: 700,
                              }}
                              value={status}
                              onChange={(e) =>
                                setStatus(
                                  r.student_id,
                                  e.target.value as AttendanceStatus
                                )
                              }
                            >
                              {ATTENDANCE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              style={{ ...inputCss, fontSize: 12 }}
                              value={sheet[r.student_id]?.notes ?? ""}
                              onChange={(e) =>
                                setNotes(r.student_id, e.target.value)
                              }
                              placeholder="Optional note"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </Card>

                  {batchMutation.isError && (
                    <ErrorBanner message="Failed to save attendance. Please try again." />
                  )}
                  {saved && (
                    <div
                      style={{
                        padding: "10px 16px",
                        background: C.greenBg,
                        color: C.greenText,
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 12,
                      }}
                    >
                      ✓ Attendance saved successfully
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryBtn
                      onClick={() => batchMutation.mutate()}
                      disabled={
                        batchMutation.isPending ||
                        Object.keys(sheet).length === 0
                      }
                    >
                      {batchMutation.isPending
                        ? "Saving…"
                        : `Save Attendance (${Object.keys(sheet).length})`}
                    </PrimaryBtn>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Summary view */}
      {viewMode === "summary" && (
        <>
          {summaryQuery.isLoading ? (
            <Card padding="16px 20px">
              <div
                style={{
                  height: 40,
                  borderRadius: 6,
                  background: C.gray100,
                  animation: "amis-pulse 1.5s ease-in-out infinite",
                }}
              />
            </Card>
          ) : summaryQuery.isError ? (
            <ErrorBanner message="Failed to load attendance summary." />
          ) : summary.length === 0 ? (
            <Card padding="24px">
              <p style={{ fontSize: 14, color: C.gray500, margin: 0 }}>
                No attendance records match the selected filters.
              </p>
            </Card>
          ) : (
            <>
              {attendanceRate !== null && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      background: C.greenBg,
                      borderRadius: 10,
                      padding: "16px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: C.greenText,
                        marginBottom: 4,
                      }}
                    >
                      Avg. Attendance Rate
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: C.greenText,
                      }}
                    >
                      {attendanceRate}%
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.blueBg,
                      borderRadius: 10,
                      padding: "16px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: C.blueText,
                        marginBottom: 4,
                      }}
                    >
                      Students
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: C.blueText,
                      }}
                    >
                      {summary.length}
                    </div>
                  </div>
                </div>
              )}

              <Card>
                {/* Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 80px 80px 80px 80px 80px 90px",
                    gap: 4,
                    padding: "8px 20px",
                    background: C.gray50,
                    borderBottom: `1px solid ${C.gray100}`,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.gray500,
                  }}
                >
                  <div>Student</div>
                  <div>Adm. No.</div>
                  <div style={{ textAlign: "center", color: STATUS_COLORS.present }}>
                    Present
                  </div>
                  <div style={{ textAlign: "center", color: STATUS_COLORS.absent }}>
                    Absent
                  </div>
                  <div style={{ textAlign: "center", color: STATUS_COLORS.late }}>
                    Late
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      color: STATUS_COLORS.excused,
                    }}
                  >
                    Excused
                  </div>
                  <div style={{ textAlign: "center" }}>Total</div>
                  <div style={{ textAlign: "center" }}>Rate</div>
                </div>
                {summary.map((s, i) => {
                  const rate =
                    s.total > 0
                      ? Math.round((Number(s.present) / Number(s.total)) * 100)
                      : 0;
                  return (
                    <div
                      key={s.student_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "2fr 1fr 80px 80px 80px 80px 80px 90px",
                        gap: 4,
                        padding: "10px 20px",
                        alignItems: "center",
                        borderBottom:
                          i < summary.length - 1
                            ? `1px solid ${C.gray100}`
                            : "none",
                      }}
                    >
                      <div
                        style={{ fontWeight: 600, fontSize: 14, color: C.gray900 }}
                      >
                        {s.last_name}, {s.first_name}
                      </div>
                      <div style={{ fontSize: 13, color: C.gray500 }}>
                        {s.admission_number ?? "—"}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: STATUS_COLORS.present,
                        }}
                      >
                        {s.present}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: STATUS_COLORS.absent,
                        }}
                      >
                        {s.absent}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: STATUS_COLORS.late,
                        }}
                      >
                        {s.late}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: STATUS_COLORS.excused,
                        }}
                      >
                        {s.excused}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 13,
                          color: C.gray500,
                        }}
                      >
                        {s.total}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            background:
                              rate >= 80
                                ? C.greenBg
                                : rate >= 60
                                  ? C.yellowBg
                                  : C.redBg,
                            color:
                              rate >= 80
                                ? C.greenText
                                : rate >= 60
                                  ? C.yellowText
                                  : C.redText,
                          }}
                        >
                          {rate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
