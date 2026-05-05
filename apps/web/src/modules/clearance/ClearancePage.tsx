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

const DEPT_LABELS: Record<string, string> = {
  store: "Store",
  library: "Library",
  sports: "Sports",
  warden: "Warden",
  hod: "Head of Department",
  dean_of_students: "Dean of Students",
  accounts: "Accounts (Finance)",
  academic_registrar: "Academic Registrar",
};

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

      {data && (
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
              Departments ({data.completed}/{data.total})
            </SectionLabel>
            {data.fully_cleared && (
              <Badge label="✅ FULLY CLEARED" color="green" />
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(data.departments).map(([dept, info]) => (
              <div
                key={dept}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background:
                    info.status === "SIGNED"
                      ? "#dcfce7"
                      : info.status === "REJECTED"
                        ? "#fee2e2"
                        : C.gray50,
                  borderRadius: 8,
                  border: `1px solid ${C.gray200}`,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>
                    {DEPT_LABELS[dept] ?? dept}
                  </span>
                  <Badge
                    label={info.status}
                    color={
                      info.status === "SIGNED"
                        ? "green"
                        : info.status === "REJECTED"
                          ? "yellow"
                          : "gray"
                    }
                  />
                  {info.remarks && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.gray500,
                        marginTop: 2,
                      }}
                    >
                      {info.remarks}
                    </div>
                  )}
                  {info.signed_at && (
                    <div style={{ fontSize: 11, color: C.gray400 }}>
                      {new Date(info.signed_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {info.status !== "SIGNED" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryBtn
                      onClick={() =>
                        signMut.mutate({ department: dept, status: "SIGNED" })
                      }
                      disabled={
                        signMut.isPending ||
                        (dept === "accounts" &&
                          eligibility?.checks.fees_cleared.pass === false) ||
                        (dept === "hod" &&
                          eligibility?.checks.marks_complete.pass === false) ||
                        (dept === "hod" &&
                          eligibility?.checks.attendance_ok?.pass === false)
                      }
                      title={
                        dept === "accounts" &&
                        eligibility?.checks.fees_cleared.pass === false
                          ? eligibility.checks.fees_cleared.detail
                          : dept === "hod" &&
                              eligibility?.checks.marks_complete.pass === false
                            ? eligibility.checks.marks_complete.detail
                            : dept === "hod" &&
                                eligibility?.checks.attendance_ok?.pass === false
                              ? eligibility.checks.attendance_ok.detail
                              : undefined
                      }
                      style={{ fontSize: 12, padding: "4px 12px" }}
                    >
                      ✅ Sign
                    </PrimaryBtn>
                    <SecondaryBtn
                      onClick={() => {
                        const remarks = prompt("Rejection remarks:");
                        if (remarks !== null) {
                          signMut.mutate({
                            department: dept,
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
              </div>
            ))}
          </div>
        </Card>
      )}

      {!statusQ.isLoading && !data && studentId && termId && (
        <EmptyState title="No clearance data. Click 'Init Clearance' to create sign-off records." />
      )}
    </div>
  );
}
