import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClearanceStatus,
  getEligibility,
  signOff,
  initClearance,
  type ClearanceStatus,
  type EligibilityResult,
} from "./clearance.api";
import { apiFetch } from "../../lib/apiFetch";
import { StudentPickerInput } from "../../lib/StudentPickerInput";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Spinner,
  EmptyState,
  Badge,
  SectionLabel,
  inputCss,
  C,
} from "../../lib/ui";

/** Ordered 11-step clearance sequence (must match backend CLEARANCE_STEPS) */
const CLEARANCE_STEPS_UI = [
  { step: 1,  dept: "academic_registrar",        label: "Academic Registrar" },
  { step: 2,  dept: "accounts",                  label: "Accountant / Finance" },
  { step: 3,  dept: "warden",                    label: "Warden / Custodian" },
  { step: 4,  dept: "store",                     label: "Stores" },
  { step: 5,  dept: "catering",                  label: "Catering Officer" },
  { step: 6,  dept: "hod",                       label: "Head of Department" },
  { step: 7,  dept: "dean_of_students",          label: "Dean of Students" },
  { step: 8,  dept: "nurse",                     label: "Nurse / Health" },
  { step: 9,  dept: "library",                   label: "Library" },
  { step: 10, dept: "ict_technician",            label: "ICT Technician" },
  { step: 11, dept: "academic_registrar_final",  label: "Academic Registrar (Final)" },
] as const;

interface Term {
  id: string;
  name: string;
  is_current: boolean;
}

export function ClearancePage() {
  ensureGlobalCss();
  const [params] = useSearchParams();
  const [studentId, setStudentId] = useState(params.get("student_id") ?? "");
  const [studentName, setStudentName] = useState("");
  const [termId, setTermId] = useState(params.get("term_id") ?? "");
  const qc = useQueryClient();

  const termsQ = useQuery({
    queryKey: ["terms"],
    queryFn: () => apiFetch<Term[]>("/terms"),
  });

  // Auto-select current term
  if (!termId && termsQ.data) {
    const current = termsQ.data.find((t) => t.is_current);
    if (current) setTermId(current.id);
    else if (termsQ.data.length > 0) setTermId(termsQ.data[0].id);
  }

  const statusQ = useQuery({
    queryKey: ["clearance", studentId, termId],
    queryFn: () => getClearanceStatus(studentId, termId),
    enabled: !!studentId && !!termId,
  });

  const eligibilityQ = useQuery({
    queryKey: ["clearance-eligibility", studentId, termId],
    queryFn: () => getEligibility(studentId, termId),
    enabled: !!studentId && !!termId,
  });

  const initMut = useMutation({
    mutationFn: () => initClearance({ student_id: studentId, term_id: termId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clearance"] }),
  });

  const signMut = useMutation({
    mutationFn: (args: {
      department: string;
      status: "SIGNED" | "REJECTED";
      remarks?: string;
    }) =>
      signOff({
        student_id: studentId,
        term_id: termId,
        ...args,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clearance"] }),
  });

  const data: ClearanceStatus | undefined = statusQ.data;
  const eligibility: EligibilityResult | undefined = eligibilityQ.data;

  return (
    <div>
      <PageHeader title="Clearance Workflow" />

      <Card style={{ padding: 20, marginBottom: 16, overflow: "visible" }}>
        <SectionLabel>Student & Term</SectionLabel>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ width: 320 }}>
            <StudentPickerInput
              value={studentId}
              displayName={studentName}
              onChange={(id, name) => { setStudentId(id); setStudentName(name); }}
              placeholder="Search student…"
            />
          </div>
          <select
            style={{ ...inputCss, width: 280 }}
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            <option value="">Select term…</option>
            {(termsQ.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
          <SecondaryBtn
            onClick={() => initMut.mutate()}
            disabled={!studentId || !termId || initMut.isPending}
          >
            Init Clearance
          </SecondaryBtn>
        </div>
      </Card>

      {statusQ.isLoading && <Spinner />}

      {eligibility && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Eligibility Checklist</SectionLabel>
            <Badge
              label={eligibility.eligible ? "✅ Eligible" : "⚠ Not Eligible"}
              color={eligibility.eligible ? "green" : "yellow"}
            />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(
              [
                ["registered", "Term Registration"],
                ["fees_cleared", "Fees Cleared"],
                ["marks_complete", "Marks Recorded"],
                ["attendance_ok", "Attendance"],
              ] as const
            ).map(([key, label]) => {
              const check = eligibility.checks[key];
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: check.pass ? "#dcfce7" : "#fef3c7",
                    border: `1px solid ${check.pass ? "#86efac" : "#fde68a"}`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{check.pass ? "✅" : "⚠️"}</span>
                  <span style={{ fontWeight: 600, minWidth: 150 }}>{label}</span>
                  <span style={{ color: C.gray500 }}>{check.detail}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {data && (() => {
        // Compute the active step: first step that is not SIGNED
        const activeStep = CLEARANCE_STEPS_UI.find(
          (s) => (data.departments[s.dept]?.status ?? "PENDING") !== "SIGNED",
        )?.step ?? null;

        return (
          <Card style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <SectionLabel>
                Clearance Progress ({data.completed}/{data.total} steps)
              </SectionLabel>
              {data.fully_cleared && (
                <Badge label="✅ FULLY CLEARED" color="green" />
              )}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {CLEARANCE_STEPS_UI.map((stepDef) => {
                const info = data.departments[stepDef.dept] ?? {
                  status: "PENDING",
                  signed_by: null,
                  signed_at: null,
                  remarks: null,
                };
                const isSigned   = info.status === "SIGNED";
                const isRejected = info.status === "REJECTED";
                const isActive   = stepDef.step === activeStep;
                const isBlocked  = !isSigned && !isRejected && !isActive;

                const bgColor = isSigned
                  ? "#dcfce7"
                  : isRejected
                    ? "#fee2e2"
                    : isActive
                      ? "#eff6ff"
                      : C.gray50;
                const borderColor = isSigned
                  ? "#86efac"
                  : isRejected
                    ? "#fca5a5"
                    : isActive
                      ? "#93c5fd"
                      : C.gray200;

                return (
                  <div
                    key={stepDef.dept}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: bgColor,
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      opacity: isBlocked ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Step number indicator */}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 1,
                          background: isSigned
                            ? "#16a34a"
                            : isRejected
                              ? "#dc2626"
                              : isActive
                                ? "#2563eb"
                                : "#9ca3af",
                          color: "#fff",
                        }}
                      >
                        {isSigned ? "✓" : isRejected ? "✗" : isBlocked ? "🔒" : stepDef.step}
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          Step {stepDef.step} · {stepDef.label}
                        </div>
                        <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                          {isSigned && info.signed_at
                            ? `Signed — ${new Date(info.signed_at).toLocaleString()}`
                            : isRejected
                              ? "Rejected"
                              : isActive
                                ? "Awaiting sign-off"
                                : "Pending previous step"}
                        </div>
                        {info.remarks && (
                          <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
                            Remarks: {info.remarks}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — only for active step */}
                    {isActive && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <PrimaryBtn
                          onClick={() =>
                            signMut.mutate({ department: stepDef.dept, status: "SIGNED" })
                          }
                          disabled={
                            signMut.isPending ||
                            (stepDef.dept === "accounts" &&
                              eligibility?.checks.fees_cleared.pass === false) ||
                            (stepDef.dept === "hod" &&
                              eligibility?.checks.marks_complete.pass === false)
                          }
                          title={
                            stepDef.dept === "accounts" &&
                            eligibility?.checks.fees_cleared.pass === false
                              ? eligibility?.checks.fees_cleared.detail
                              : stepDef.dept === "hod" &&
                                  eligibility?.checks.marks_complete.pass === false
                                ? eligibility?.checks.marks_complete.detail
                                : undefined
                          }
                          style={{ fontSize: 12, padding: "4px 14px" }}
                        >
                          ✅ Sign
                        </PrimaryBtn>
                        <SecondaryBtn
                          onClick={() => {
                            const remarks = prompt("Rejection remarks:");
                            if (remarks !== null) {
                              signMut.mutate({
                                department: stepDef.dept,
                                status: "REJECTED",
                                remarks,
                              });
                            }
                          }}
                          disabled={signMut.isPending}
                          style={{ fontSize: 12, padding: "4px 12px" }}
                        >
                          ❌ Reject
                        </SecondaryBtn>
                      </div>
                    )}

                    {/* Re-sign button for rejected step */}
                    {isRejected && (
                      <PrimaryBtn
                        onClick={() =>
                          signMut.mutate({ department: stepDef.dept, status: "SIGNED" })
                        }
                        disabled={signMut.isPending}
                        style={{ fontSize: 12, padding: "4px 14px", flexShrink: 0 }}
                      >
                        Re-sign
                      </PrimaryBtn>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {!statusQ.isLoading && !data && studentId && termId && (
        <EmptyState title="No clearance data. Click 'Init Clearance' to create sign-off records." />
      )}
    </div>
  );
}
