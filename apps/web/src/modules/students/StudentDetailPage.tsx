import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getStudent,
  updateStudent,
  deactivateStudent,
  reactivateStudent,
  type UpdateStudentBody,
  type DeactivateStudentBody,
} from "./students.api";
import { graduateStudent } from "../alumni/alumni.api";
import { StudentDocumentsSection } from "./StudentDocumentsSection";
import { listStudentProjects, createStudentProject, type ProjectStatus } from "../student-projects/student-projects.api";
import { listProgrammes } from "../programmes/programmes.api";
import { getFeeSummary, getFeeClearance } from "../fees/fees.api";
import { listTermRegistrations } from "../term-registrations/term-registrations.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  StatCard,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";
import { formatStudentName } from "../../lib/formatStudentName";

export function StudentDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { studentFormConfig } = useConfig();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    other_names: "",
    date_of_birth: "",
    gender: "",
    nin: "",
    admission_number: "",
    sponsorship_type: "",
    programme: "",
    programme_code: "",
    email: "",
    phone: "",
    year_of_study: "",
    class_section: "",
    assessment_level: "",
    previous_index: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    guardian_relationship: "",
  });

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [graduationDate, setGraduationDate] = useState(new Date().toISOString().slice(0, 10));
  const [graduationNotes, setGraduationNotes] = useState("");
  const [dropoutForm, setDropoutForm] = useState<DeactivateStudentBody>({
    dropout_reason: "",
    dropout_date: "",
    dropout_notes: "",
  });

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const {
    data: student,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["students", id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateStudentBody) => updateStudent(id!, body),
    onSuccess: (updated) => {
      qc.setQueryData(["students", id], updated);
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditing(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (body: DeactivateStudentBody) => deactivateStudent(id!, body),
    onSuccess: (updated) => {
      qc.setQueryData(["students", id], updated);
      qc.invalidateQueries({ queryKey: ["students"] });
      setShowDeactivateModal(false);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateStudent(id!),
    onSuccess: (updated) => {
      qc.setQueryData(["students", id], updated);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const graduateMutation = useMutation({
    mutationFn: () =>
      graduateStudent(id!, {
        graduation_date: graduationDate,
        graduation_notes: graduationNotes || undefined,
      }),
    onSuccess: () => {
      setShowGraduateModal(false);
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate("/alumni");
    },
  });

  // --- Projects ---
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ project_title: "", description: "", status: "draft" as ProjectStatus });
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["studentProjects", id],
    queryFn: () => listStudentProjects({ student_id: id }),
    enabled: !!id,
  });

  const createProjectMut = useMutation({
    mutationFn: () => createStudentProject({ student_id: id!, project_title: projectForm.project_title, description: projectForm.description || undefined, status: projectForm.status }),
    onSuccess: (created) => {
      setProjectCreateError(null);
      setShowProjectForm(false);
      setProjectForm({ project_title: "", description: "", status: "draft" });
      qc.invalidateQueries({ queryKey: ["studentProjects", id] });
      navigate(`/student-projects/${created.id}`);
    },
    onError: (err) => setProjectCreateError(err instanceof Error ? err.message : "Failed"),
  });

  function startEdit() {
    setForm({
      first_name: student!.first_name,
      last_name: student!.last_name,
      other_names: student!.other_names ?? "",
      date_of_birth: student!.date_of_birth ?? "",
      gender: student!.gender ?? "",
      nin: student!.nin ?? "",
      admission_number: student!.admission_number ?? "",
      sponsorship_type: student!.sponsorship_type ?? "",
      programme: student!.programme ?? "",
      programme_code: student!.programme_code ?? "",
      email: student!.email ?? "",
      phone: student!.phone ?? "",
      year_of_study: student!.year_of_study != null ? String(student!.year_of_study) : "",
      class_section: student!.class_section ?? "",
      assessment_level: student!.assessment_level != null ? String(student!.assessment_level) : "",
      previous_index: student!.previous_index ?? "",
      guardian_name: student!.guardian_name ?? "",
      guardian_phone: student!.guardian_phone ?? "",
      guardian_email: student!.guardian_email ?? "",
      guardian_relationship: student!.guardian_relationship ?? "",
    });
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateStudentBody = {
      first_name: form.first_name,
      last_name: form.last_name,
      other_names: form.other_names || undefined,
      gender: (form.gender as "male" | "female" | "other") || undefined,
      nin: form.nin || undefined,
      admission_number: form.admission_number || undefined,
      sponsorship_type: form.sponsorship_type || undefined,
      programme: form.programme || undefined,
      programme_code: form.programme_code || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      guardian_name: form.guardian_name || undefined,
      guardian_phone: form.guardian_phone || undefined,
      guardian_email: form.guardian_email || undefined,
      guardian_relationship: form.guardian_relationship || undefined,
      year_of_study: form.year_of_study ? Number(form.year_of_study) : undefined,
      class_section: form.class_section || undefined,
      assessment_level: form.assessment_level ? Number(form.assessment_level) : undefined,
      previous_index: form.previous_index || undefined,
    };
    if (form.date_of_birth) body.date_of_birth = form.date_of_birth;
    mutation.mutate(body);
  }

  const extensionFields = studentFormConfig?.extensionFields ?? [];

  const extra = useQueries({
    queries: [
      {
        queryKey: ["feeSummary", id],
        queryFn: () => getFeeSummary(id!),
        enabled: !!id,
      },
      {
        queryKey: ["term-regs-student", id],
        queryFn: () => listTermRegistrations({ student_id: id!, limit: 5 }),
        enabled: !!id,
      },
      {
        queryKey: ["feeClearance", id],
        queryFn: () => getFeeClearance(id!),
        enabled: !!id,
      },
    ],
  });

  const [feeQ, tregQ, clearanceQ] = extra;
  const summary = feeQ.data;
  const termRegs = tregQ.data ?? [];
  const clearance = clearanceQ.data;

  if (isLoading) return <Spinner />;
  if (error || !student)
    return (
      <div>
        <PageHeader
          title="Student"
          back={{ label: "Students", to: "/students" }}
        />
        <ErrorBanner message="Student not found." />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={formatStudentName(student)}
        back={{ label: "Students", to: "/students" }}
        action={
          !editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge
                label={student.is_active ? "Active" : "Inactive"}
                color={student.is_active ? "green" : "gray"}
              />
              <PrimaryBtn onClick={startEdit}>Edit</PrimaryBtn>
              <SecondaryBtn onClick={() => setShowGraduateModal(true)}>
                Graduate
              </SecondaryBtn>
              {student.is_active ? (
                <SecondaryBtn
                  onClick={() => {
                    setDropoutForm({ dropout_reason: "", dropout_date: "", dropout_notes: "" });
                    setShowDeactivateModal(true);
                  }}
                  disabled={deactivateMutation.isPending}
                >
                  Deactivate
                </SecondaryBtn>
              ) : (
                <SecondaryBtn
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                >
                  {reactivateMutation.isPending
                    ? "Reactivating…"
                    : "Reactivate"}
                </SecondaryBtn>
              )}
            </div>
          ) : undefined
        }
      />

      {!editing ? (
        <>
          <Card padding="0 24px" style={{ marginBottom: 20 }}>
            <DetailRow label="First name">{student.first_name}</DetailRow>
            <DetailRow label="Last name">{student.last_name}</DetailRow>
            {student.other_names && <DetailRow label="Other names">{student.other_names}</DetailRow>}
            <DetailRow label="Programme">{student.programme ?? "—"}</DetailRow>
            <DetailRow label="Admission No.">{student.admission_number ?? "—"}</DetailRow>
            <DetailRow label="Date of birth">{student.date_of_birth ?? "—"}</DetailRow>
            {student.sponsorship_type && <DetailRow label="Sponsorship">{student.sponsorship_type}</DetailRow>}
            {student.email && <DetailRow label="Email">{student.email}</DetailRow>}
            {student.phone && <DetailRow label="Phone">{student.phone}</DetailRow>}
            {extensionFields.map((f) => (
              <Fragment key={f.key}>
                <DetailRow label={f.label}>
                  {String(student.extension?.[f.key] ?? "—")}
                </DetailRow>
              </Fragment>
            ))}
          </Card>

          {/* UVTAB / Exam Registration fields — only shown when at least one field has a value */}
          {(student.nin || student.gender || student.programme_code || student.assessment_level != null || student.previous_index) && (
            <Card padding="0 24px" style={{ marginBottom: 20 }}>
              <div style={{ padding: "16px 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.gray500 }}>UVTAB / Exam Registration</div>
              {student.nin && <DetailRow label="NIN">{student.nin}</DetailRow>}
              {student.gender && <DetailRow label="Gender">{student.gender.charAt(0).toUpperCase() + student.gender.slice(1)}</DetailRow>}
              {student.programme_code && <DetailRow label="Programme Code">{student.programme_code}</DetailRow>}
              {student.assessment_level != null && <DetailRow label="Assessment Level">Level {student.assessment_level}</DetailRow>}
              {student.previous_index && <DetailRow label="Previous Index">{student.previous_index}</DetailRow>}
            </Card>
          )}

          {/* Guardian / Next-of-Kin (SR-F-002) */}
          {(student.guardian_name || student.guardian_phone || student.guardian_email || student.guardian_relationship) && (
            <Card padding="0 24px" style={{ marginBottom: 20 }}>
              <div style={{ padding: "16px 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.gray500 }}>Guardian / Next of Kin</div>
              {student.guardian_name && <DetailRow label="Name">{student.guardian_name}</DetailRow>}
              {student.guardian_relationship && <DetailRow label="Relationship">{student.guardian_relationship}</DetailRow>}
              {student.guardian_phone && <DetailRow label="Phone">{student.guardian_phone}</DetailRow>}
              {student.guardian_email && <DetailRow label="Email">{student.guardian_email}</DetailRow>}
            </Card>
          )}

          {/* Dropout info (SR-F-003) */}
          {!student.is_active && (student.dropout_reason || student.dropout_date || student.dropout_notes) && (
            <Card padding="16px 24px" style={{ marginBottom: 20, borderLeft: `4px solid ${C.red}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.red, marginBottom: 8 }}>Dropout / Deactivation Record</div>
              {student.dropout_date && <DetailRow label="Date">{student.dropout_date}</DetailRow>}
              {student.dropout_reason && <DetailRow label="Reason">{student.dropout_reason}</DetailRow>}
              {student.dropout_notes && <DetailRow label="Notes">{student.dropout_notes}</DetailRow>}
            </Card>
          )}

          {/* Fee summary */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Fees</SectionLabel>
            {feeQ.isLoading ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))",
                  gap: 12,
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 72,
                      borderRadius: 10,
                      background: C.gray100,
                      animation: "amis-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : summary ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <StatCard
                    label="Total Due"
                    value={`UGX ${summary.totalDue.toLocaleString()}`}
                    accent={C.blue}
                  />
                  <StatCard
                    label="Total Paid"
                    value={`UGX ${summary.totalPaid.toLocaleString()}`}
                    accent={C.green}
                  />
                  <StatCard
                    label="Balance"
                    value={`UGX ${summary.balance.toLocaleString()}`}
                    accent={summary.balance > 0 ? C.red : C.green}
                  />
                  <Card padding="16px 20px">
                    <div
                      style={{
                        fontSize: 11,
                        color: C.gray500,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      Status
                    </div>
                    <Badge
                      label={summary.badge}
                      color={
                        summary.badge === "PAID"
                          ? "green"
                          : summary.badge === "PARTIAL"
                            ? "yellow"
                            : "red"
                      }
                    />
                    {summary.lastPayment && (
                      <div
                        style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}
                      >
                        Last:{" "}
                        {new Date(summary.lastPayment).toLocaleDateString()}
                      </div>
                    )}
                  </Card>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <SecondaryBtn
                    onClick={() =>
                      navigate(
                        `/finance/entry?student_id=${id}&student_name=${encodeURIComponent(formatStudentName(student))}`,
                      )
                    }
                  >
                    + Record Payment
                  </SecondaryBtn>
                  <SecondaryBtn
                    onClick={() => navigate(`/finance/receipt?student_id=${id}`)}
                  >
                    🖨 Print Receipt
                  </SecondaryBtn>
                </div>
              </>
            ) : (
              <Card padding="16px 20px">
                <span style={{ fontSize: 13, color: C.gray400 }}>
                  Fee data unavailable — ensure a published config exists.
                </span>
              </Card>
            )}
          </div>

          {/* Fee clearance badge */}
          {clearance && (
            <Card
              padding="16px 24px"
              style={{
                marginBottom: 20,
                borderLeft: `4px solid ${clearance.cleared ? C.green : C.red}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: clearance.cleared ? C.green : C.red,
                      marginBottom: 4,
                    }}
                  >
                    Fee Clearance
                  </div>
                  <div style={{ fontSize: 13, color: C.gray500 }}>
                    Threshold: {clearance.threshold}% of total due &middot;
                    Required: UGX {Number(clearance.requiredAmount).toLocaleString()}
                  </div>
                </div>
                <Badge
                  label={clearance.cleared ? "CLEARED" : "NOT CLEARED"}
                  color={clearance.cleared ? "green" : "red"}
                />
              </div>
            </Card>
          )}

          {/* Term registrations */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <SectionLabel>Term Registrations</SectionLabel>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <SecondaryBtn
                  onClick={() =>
                    navigate(
                      `/term-registrations/new?student_id=${id}&student_name=${encodeURIComponent(formatStudentName(student))}`,
                    )
                  }
                >
                  + Register for Term
                </SecondaryBtn>
                <button
                  onClick={() => navigate(`/term-registrations?student_id=${id}`)}
                  style={{
                    fontSize: 12,
                    color: C.primary,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  View all →
                </button>
              </div>
            </div>
            {tregQ.isLoading ? (
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
            ) : termRegs.length === 0 ? (
              <Card padding="16px 20px">
                <span style={{ fontSize: 13, color: C.gray400 }}>
                  No term registrations yet.{" "}
                  <button
                    onClick={() =>
                      navigate(
                        `/term-registrations/new?student_id=${id}&student_name=${encodeURIComponent(formatStudentName(student))}`,
                      )
                    }
                    style={{
                      color: C.primary,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Register now →
                  </button>
                </span>
              </Card>
            ) : (
              <Card>
                {termRegs.map((reg, i) => {
                  const STATE_COLOR: Record<
                    string,
                    | "gray"
                    | "blue"
                    | "cyan"
                    | "green"
                    | "yellow"
                    | "indigo"
                    | "purple"
                  > = {
                    REGISTRATION_STARTED: "gray",
                    DOCUMENTS_VERIFIED: "blue",
                    FEES_VERIFIED: "cyan",
                    GUILD_FEES_VERIFIED: "purple",
                    DEAN_ENDORSED: "green",
                    HALL_ALLOCATED: "yellow",
                    CLEARANCE_ISSUED: "green",
                    EXAM_ENROLLED: "indigo",
                  };
                  return (
                    <div
                      key={reg.id}
                      onClick={() => navigate(`/term-registrations/${reg.id}`)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 20px",
                        borderBottom:
                          i < termRegs.length - 1
                            ? `1px solid ${C.gray100}`
                            : "none",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          C.gray50;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          "transparent";
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 600,
                            color: C.gray900,
                            fontSize: 14,
                          }}
                        >
                          {reg.academic_year} · {reg.term}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {reg.current_state && (
                          <Badge
                            label={reg.current_state}
                            color={STATE_COLOR[reg.current_state] ?? "gray"}
                          />
                        )}
                        <span style={{ color: C.gray300, fontSize: 14 }}>
                          ›
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          {/* Results / Transcript */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Results</SectionLabel>
            <Card padding="16px 20px">
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryBtn
                  onClick={() =>
                    navigate(`/results/transcript?student_id=${id}`)
                  }
                >
                  📄 Academic Transcript
                </SecondaryBtn>
              </div>
            </Card>
          </div>

          {/* Student Projects */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${C.gray100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SectionLabel>Projects ({projects?.length ?? 0})</SectionLabel>
              <button
                onClick={() => setShowProjectForm((v) => !v)}
                style={{ fontSize: 12, fontWeight: 600, color: C.primary, background: "none", border: `1px solid ${C.primary}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
              >
                {showProjectForm ? "Cancel" : "+ New Project"}
              </button>
            </div>
            {showProjectForm && (
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.gray100}` }}>
                {projectCreateError && <ErrorBanner message={projectCreateError} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    style={inputCss}
                    placeholder="Project title *"
                    value={projectForm.project_title}
                    onChange={(e) => setProjectForm((f) => ({ ...f, project_title: e.target.value }))}
                  />
                  <textarea
                    style={{ ...inputCss, minHeight: 56, resize: "vertical" }}
                    placeholder="Description (optional)"
                    value={projectForm.description}
                    onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <select
                    style={inputCss}
                    value={projectForm.status}
                    onChange={(e) => setProjectForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                  >
                    {(["draft", "active", "submitted", "assessed"] as ProjectStatus[]).map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <div>
                    <PrimaryBtn
                      onClick={() => createProjectMut.mutate()}
                      disabled={!projectForm.project_title.trim() || createProjectMut.isPending}
                    >
                      {createProjectMut.isPending ? "Creating…" : "Create Project"}
                    </PrimaryBtn>
                  </div>
                </div>
              </div>
            )}
            {!projects?.length ? (
              <p style={{ padding: "16px 24px", color: C.gray400, fontSize: 14, margin: 0 }}>No projects yet.</p>
            ) : (
              projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/student-projects/${proj.id}`)}
                  style={{ padding: "12px 24px", borderBottom: `1px solid ${C.gray100}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{proj.project_title}</div>
                    {proj.description && <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>{proj.description}</div>}
                  </div>
                  <Badge
                    label={proj.status}
                    color={proj.status === "assessed" ? "green" : proj.status === "submitted" ? "yellow" : proj.status === "active" ? "blue" : "gray"}
                  />
                </div>
              ))
            )}
          </Card>

          {/* Documents & Photos */}
          <StudentDocumentsSection studentId={id!} />
        </>
      ) : (
        <Card padding="24px" style={{ maxWidth: 600 }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Name row — two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First name *">
                <input
                  style={inputCss}
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Last name *">
                <input
                  style={inputCss}
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Other names">
              <input
                style={inputCss}
                value={form.other_names}
                onChange={(e) => setForm({ ...form, other_names: e.target.value })}
                placeholder="Middle or additional names"
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date of birth">
                <input
                  type="date"
                  style={inputCss}
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </Field>
              <Field label="Sponsorship / Fee Category">
                <select
                  style={selectCss}
                  value={form.sponsorship_type}
                  onChange={(e) => setForm({ ...form, sponsorship_type: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {["Government", "Private", "Self-Sponsored", "Scholarship", "Other"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Programme">
                <select
                  style={selectCss}
                  value={form.programme}
                  onChange={(e) => setForm({ ...form, programme: e.target.value })}
                >
                  <option value="">— Select Programme —</option>
                  {(programmes ?? []).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Admission Number">
                <input
                  style={inputCss}
                  value={form.admission_number}
                  onChange={(e) => setForm({ ...form, admission_number: e.target.value })}
                  placeholder="e.g. 2024/CS/001"
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Year of Study">
                <select
                  style={selectCss}
                  value={form.year_of_study}
                  onChange={(e) => setForm({ ...form, year_of_study: e.target.value })}
                >
                  <option value="">— Select Year —</option>
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
              </Field>
              <Field label="Class Section">
                <input
                  style={inputCss}
                  placeholder="e.g. A, B"
                  value={form.class_section}
                  onChange={(e) => setForm({ ...form, class_section: e.target.value })}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Phone">
                <input
                  style={inputCss}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+256 …"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  style={inputCss}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="student@example.com"
                />
              </Field>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: 8 }}>UVTAB / Exam Registration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="NIN (National Identity Number)">
                <input
                  style={inputCss}
                  value={form.nin}
                  onChange={(e) => setForm({ ...form, nin: e.target.value })}
                  placeholder="CM12345678ABCDE"
                  maxLength={14}
                />
              </Field>
              <Field label="Gender">
                <select
                  style={selectCss}
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Programme Code">
                <input
                  style={inputCss}
                  value={form.programme_code}
                  onChange={(e) => setForm({ ...form, programme_code: e.target.value })}
                  placeholder="e.g. NCES, NCBC"
                />
              </Field>
              <Field label="Assessment Level">
                <select
                  style={selectCss}
                  value={form.assessment_level}
                  onChange={(e) => setForm({ ...form, assessment_level: e.target.value })}
                >
                  <option value="">— Select Level —</option>
                  {[1, 2, 3, 4].map((l) => (
                    <option key={l} value={l}>Level {l}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Previous Index (PLE/UCE)">
              <input
                style={inputCss}
                value={form.previous_index}
                onChange={(e) => setForm({ ...form, previous_index: e.target.value })}
                placeholder="e.g. U1234/5678"
              />
            </Field>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: 8 }}>Guardian / Next of Kin</div>
            <Field label="Guardian name">
              <input
                style={inputCss}
                value={form.guardian_name}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                placeholder="Full name"
              />
            </Field>
            <Field label="Relationship">
              <input
                style={inputCss}
                value={form.guardian_relationship}
                onChange={(e) => setForm({ ...form, guardian_relationship: e.target.value })}
                placeholder="e.g. Mother, Father, Sibling"
              />
            </Field>
            <Field label="Guardian phone">
              <input
                style={inputCss}
                value={form.guardian_phone}
                onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                placeholder="+256 …"
              />
            </Field>
            <Field label="Guardian email">
              <input
                type="email"
                style={inputCss}
                value={form.guardian_email}
                onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                placeholder="guardian@example.com"
              />
            </Field>
            {mutation.isError && (
              <ErrorBanner message="Save failed. Please try again." />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryBtn type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setEditing(false)}>
                Cancel
              </SecondaryBtn>
            </div>
          </form>
        </Card>
      )}

      {showGraduateModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGraduateModal(false); }}
        >
          <Card padding="28px" style={{ width: 440, maxWidth: "95vw" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Graduate Student</div>
            <div style={{ fontSize: 13, color: C.gray500, marginBottom: 20 }}>
              This will add the student to Alumni and mark the student inactive.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Graduation date" required>
                <input
                  type="date"
                  style={inputCss}
                  value={graduationDate}
                  onChange={(e) => setGraduationDate(e.target.value)}
                />
              </Field>
              <Field label="Graduation notes">
                <textarea
                  style={{ ...inputCss, height: 72, resize: "vertical" }}
                  value={graduationNotes}
                  onChange={(e) => setGraduationNotes(e.target.value)}
                  placeholder="Award, qualification, or other graduation details"
                />
              </Field>
              {graduateMutation.isError && <ErrorBanner message="Graduation failed. Please try again." />}
              <div style={{ display: "flex", gap: 8 }}>
                <PrimaryBtn
                  onClick={() => graduateMutation.mutate()}
                  disabled={!graduationDate || graduateMutation.isPending}
                >
                  {graduateMutation.isPending ? "Graduating…" : "Confirm Graduation"}
                </PrimaryBtn>
                <SecondaryBtn onClick={() => setShowGraduateModal(false)}>Cancel</SecondaryBtn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Deactivate / Dropout modal (SR-F-003) */}
      {showDeactivateModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeactivateModal(false); }}
        >
          <Card padding="28px" style={{ width: 440, maxWidth: "95vw" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Deactivate Student</div>
            <div style={{ fontSize: 13, color: C.gray500, marginBottom: 20 }}>
              Optionally record the reason for deactivation / dropout.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Dropout date">
                <input
                  type="date"
                  style={inputCss}
                  value={dropoutForm.dropout_date ?? ""}
                  onChange={(e) => setDropoutForm({ ...dropoutForm, dropout_date: e.target.value })}
                />
              </Field>
              <Field label="Reason">
                <input
                  style={inputCss}
                  value={dropoutForm.dropout_reason ?? ""}
                  onChange={(e) => setDropoutForm({ ...dropoutForm, dropout_reason: e.target.value })}
                  placeholder="e.g. Financial hardship, Transfer, Medical leave"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  style={{ ...inputCss, height: 72, resize: "vertical" }}
                  value={dropoutForm.dropout_notes ?? ""}
                  onChange={(e) => setDropoutForm({ ...dropoutForm, dropout_notes: e.target.value })}
                  placeholder="Any additional context…"
                />
              </Field>
              {deactivateMutation.isError && <ErrorBanner message="Deactivation failed. Please try again." />}
              <div style={{ display: "flex", gap: 8 }}>
                <PrimaryBtn
                  onClick={() => deactivateMutation.mutate(dropoutForm)}
                  disabled={deactivateMutation.isPending}
                >
                  {deactivateMutation.isPending ? "Deactivating…" : "Confirm Deactivate"}
                </PrimaryBtn>
                <SecondaryBtn onClick={() => setShowDeactivateModal(false)}>Cancel</SecondaryBtn>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
