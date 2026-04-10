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
} from "./students.api";
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
    mutationFn: () => deactivateStudent(id!),
    onSuccess: (updated) => {
      qc.setQueryData(["students", id], updated);
      qc.invalidateQueries({ queryKey: ["students"] });
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
    });
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateStudentBody = {
      first_name: form.first_name,
      last_name: form.last_name,
      admission_number: form.admission_number || undefined,
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
                  onClick={() => deactivateMutation.mutate()}
                  disabled={deactivateMutation.isPending}
                >
                  {deactivateMutation.isPending ? "Deactivating…" : "Deactivate"}
                </SecondaryBtn>
              ) : (
                <SecondaryBtn
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                >
                  {reactivateMutation.isPending ? "Reactivating…" : "Reactivate"}
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
    </div>
  );
}
