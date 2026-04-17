import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getStudent,
  updateStudent,
  deactivateStudent,
  reactivateStudent,
  type UpdateStudentBody,
  type DeactivateStudentBody,
} from "./students.api";
import { listProgrammes } from "../programmes/programmes.api";
import { getFeeSummary } from "../fees/fees.api";
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
    date_of_birth: "",
    admission_number: "",
    programme: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    guardian_relationship: "",
  });

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
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

  function startEdit() {
    setForm({
      first_name: student!.first_name,
      last_name: student!.last_name,
      date_of_birth: student!.date_of_birth ?? "",
      admission_number: student!.admission_number ?? "",
      programme: student!.programme ?? "",
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
      admission_number: form.admission_number || undefined,
      programme: form.programme || undefined,
      guardian_name: form.guardian_name || undefined,
      guardian_phone: form.guardian_phone || undefined,
      guardian_email: form.guardian_email || undefined,
      guardian_relationship: form.guardian_relationship || undefined,
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
    ],
  });

  const [feeQ, tregQ] = extra;
  const summary = feeQ.data;
  const termRegs = tregQ.data ?? [];

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
        title={`${student.first_name} ${student.last_name}`}
        back={{ label: "Students", to: "/students" }}
        action={
          !editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge
                label={student.is_active ? "Active" : "Inactive"}
                color={student.is_active ? "green" : "gray"}
              />
              <PrimaryBtn onClick={startEdit}>Edit</PrimaryBtn>
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
            <DetailRow label="Programme">{student.programme ?? "—"}</DetailRow>
            <DetailRow label="Admission No.">
              {student.admission_number ?? "—"}
            </DetailRow>
            <DetailRow label="Date of birth">
              {student.date_of_birth ?? "—"}
            </DetailRow>
            {extensionFields.map((f) => (
              <Fragment key={f.key}>
                <DetailRow label={f.label}>
                  {String(student.extension?.[f.key] ?? "—")}
                </DetailRow>
              </Fragment>
            ))}
          </Card>

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
                <SecondaryBtn
                  onClick={() =>
                    navigate(
                      `/finance/entry?student_id=${id}&student_name=${encodeURIComponent(`${student.first_name} ${student.last_name}`)}`,
                    )
                  }
                >
                  + Record Payment
                </SecondaryBtn>
              </>
            ) : (
              <Card padding="16px 20px">
                <span style={{ fontSize: 13, color: C.gray400 }}>
                  Fee data unavailable — ensure a published config exists.
                </span>
              </Card>
            )}
          </div>

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
                        `/term-registrations/new?student_id=${id}&student_name=${encodeURIComponent(`${student.first_name} ${student.last_name}`)}`,
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
        </>
      ) : (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field label="First name *">
              <input
                style={inputCss}
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Last name *">
              <input
                style={inputCss}
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                style={inputCss}
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm({ ...form, date_of_birth: e.target.value })
                }
              />
            </Field>
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
                onChange={(e) =>
                  setForm({ ...form, admission_number: e.target.value })
                }
                placeholder="e.g. 2024/CS/001"
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
