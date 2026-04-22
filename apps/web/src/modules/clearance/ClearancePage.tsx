import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClearanceStatus,
  signOff,
  initClearance,
  type ClearanceStatus,
} from "./clearance.api";
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

export function ClearancePage() {
  ensureGlobalCss();
  const [params] = useSearchParams();
  const [studentId, setStudentId] = useState(params.get("student_id") ?? "");
  const [studentName, setStudentName] = useState("");
  const [termId, setTermId] = useState(params.get("term_id") ?? "");
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["clearance", studentId, termId],
    queryFn: () => getClearanceStatus(studentId, termId),
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

  return (
    <div>
      <PageHeader title="Clearance Workflow" />

      <Card style={{ padding: 20, marginBottom: 16 }}>
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
          <input
            style={{ ...inputCss, width: 280 }}
            placeholder="Term ID"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          />
          <SecondaryBtn
            onClick={() => initMut.mutate()}
            disabled={!studentId || !termId || initMut.isPending}
          >
            Init Clearance
          </SecondaryBtn>
        </div>
      </Card>

      {statusQ.isLoading && <Spinner />}

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
                      disabled={signMut.isPending}
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
