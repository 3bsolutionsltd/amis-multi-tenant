import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStaff,
  updateStaff,
  listContracts,
  createContract,
  listAttendance,
  recordAttendance,
  listAppraisals,
  createAppraisal,
  type UpdateStaffBody,
  type CreateContractBody,
  type CreateAttendanceBody,
  type CreateAppraisalBody,
} from "./staff.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  SectionLabel,
  DetailRow,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  ErrorBanner,
  Badge,
  DataTable,
  TR,
  TD,
  C,
} from "../../lib/ui";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

const RATING_STARS = (r: number | null) =>
  r != null ? "★".repeat(r) + "☆".repeat(5 - r) : "—";

export function StaffDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateStaffBody>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Contract form
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractForm, setContractForm] = useState<CreateContractBody>({
    contract_type: "",
    start_date: "",
  });

  // Attendance form
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState<CreateAttendanceBody>({
    attendance_date: "",
    session: "full",
    status: "present",
  });

  // Appraisal form
  const [showAppraisalForm, setShowAppraisalForm] = useState(false);
  const [appraisalForm, setAppraisalForm] = useState<CreateAppraisalBody>({
    period: "",
  });

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ["staff", id],
    queryFn: () => getStaff(id!),
    enabled: !!id,
  });

  const { data: contracts } = useQuery({
    queryKey: ["staff-contracts", id],
    queryFn: () => listContracts(id!),
    enabled: !!id,
  });

  const { data: attendance } = useQuery({
    queryKey: ["staff-attendance", id],
    queryFn: () => listAttendance(id!),
    enabled: !!id,
  });

  const { data: appraisals } = useQuery({
    queryKey: ["staff-appraisals", id],
    queryFn: () => listAppraisals(id!),
    enabled: !!id,
  });

  const saveMut = useMutation({
    mutationFn: (body: UpdateStaffBody) => updateStaff(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", id] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      setEditing(false);
      setSaveError(null);
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : "Failed to save"),
  });

  const contractMut = useMutation({
    mutationFn: (body: CreateContractBody) => createContract(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-contracts", id] });
      setShowContractForm(false);
      setContractForm({ contract_type: "", start_date: "" });
    },
  });

  const attendanceMut = useMutation({
    mutationFn: (body: CreateAttendanceBody) => recordAttendance(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance", id] });
      setShowAttendanceForm(false);
      setAttendanceForm({ attendance_date: "", session: "full", status: "present" });
    },
  });

  const appraisalMut = useMutation({
    mutationFn: (body: CreateAppraisalBody) => createAppraisal(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-appraisals", id] });
      setShowAppraisalForm(false);
      setAppraisalForm({ period: "" });
    },
  });

  function startEdit() {
    if (!staff) return;
    setForm({
      staff_number: staff.staff_number ?? "",
      first_name: staff.first_name,
      last_name: staff.last_name,
      email: staff.email ?? "",
      phone: staff.phone ?? "",
      department: staff.department ?? "",
      designation: staff.designation ?? "",
      employment_type: staff.employment_type ?? undefined,
      join_date: staff.join_date ?? "",
      salary: staff.salary ?? undefined,
      notes: staff.notes ?? "",
    });
    setSaveError(null);
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateStaffBody = {
      staff_number: form.staff_number || undefined,
      first_name: form.first_name || undefined,
      last_name: form.last_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department: form.department || undefined,
      designation: form.designation || undefined,
      employment_type: form.employment_type || undefined,
      join_date: form.join_date || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      notes: form.notes || undefined,
    };
    saveMut.mutate(body);
  }

  if (isLoading) return <div style={C.page}>Loading…</div>;
  if (error || !staff)
    return (
      <div style={C.page}>
        <ErrorBanner
          message={error instanceof Error ? error.message : "Staff not found"}
        />
      </div>
    );

  return (
    <div style={C.page}>
      <PageHeader
        title={`${staff.first_name} ${staff.last_name}`}
        subtitle={staff.designation ?? "Staff Member"}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryBtn onClick={() => navigate("/staff")}>← Back</SecondaryBtn>
            {!editing && <PrimaryBtn onClick={startEdit}>Edit</PrimaryBtn>}
          </div>
        }
      />

      {/* ---- Profile ---- */}
      <Card>
        <SectionLabel>Profile</SectionLabel>
        {!editing ? (
          <div>
            <DetailRow label="Staff Number">
              {staff.staff_number ?? "—"}
            </DetailRow>
            <DetailRow label="Name">
              {staff.first_name} {staff.last_name}
            </DetailRow>
            <DetailRow label="Email">{staff.email ?? "—"}</DetailRow>
            <DetailRow label="Phone">{staff.phone ?? "—"}</DetailRow>
            <DetailRow label="Department">{staff.department ?? "—"}</DetailRow>
            <DetailRow label="Designation">{staff.designation ?? "—"}</DetailRow>
            <DetailRow label="Employment Type">
              {staff.employment_type
                ? EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type
                : "—"}
            </DetailRow>
            <DetailRow label="Join Date">{staff.join_date ?? "—"}</DetailRow>
            <DetailRow label="Salary">
              {staff.salary != null
                ? `ZAR ${Number(staff.salary).toLocaleString()}`
                : "—"}
            </DetailRow>
            <DetailRow label="Status">
              <Badge variant={staff.is_active ? "success" : "neutral"}>
                {staff.is_active ? "Active" : "Inactive"}
              </Badge>
            </DetailRow>
            <DetailRow label="Notes">{staff.notes ?? "—"}</DetailRow>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name" required>
                <input
                  required
                  style={inputCss}
                  value={form.first_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  required
                  style={inputCss}
                  value={form.last_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Staff Number">
                <input
                  style={inputCss}
                  value={form.staff_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, staff_number: e.target.value }))}
                />
              </Field>
              <Field label="Employment Type">
                <select
                  style={selectCss}
                  value={form.employment_type ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employment_type: e.target.value as UpdateStaffBody["employment_type"] || undefined,
                    }))
                  }
                >
                  <option value="">— Select —</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Department">
                <input
                  style={inputCss}
                  value={form.department ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </Field>
              <Field label="Designation">
                <input
                  style={inputCss}
                  value={form.designation ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Email">
                <input
                  type="email"
                  style={inputCss}
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Phone">
                <input
                  style={inputCss}
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Join Date">
                <input
                  type="date"
                  style={inputCss}
                  value={form.join_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))}
                />
              </Field>
              <Field label="Salary (ZAR)">
                <input
                  type="number"
                  min={0}
                  style={inputCss}
                  value={form.salary ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      salary: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                style={{ ...inputCss, minHeight: 60, resize: "vertical" }}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
            {saveError && <ErrorBanner message={saveError} />}
            <div style={{ display: "flex", gap: 10 }}>
              <PrimaryBtn type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save Changes"}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setEditing(false)}>
                Cancel
              </SecondaryBtn>
            </div>
          </form>
        )}
      </Card>

      {/* ---- Contracts ---- */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <SectionLabel>Contracts</SectionLabel>
          <SecondaryBtn onClick={() => setShowContractForm((v) => !v)}>
            {showContractForm ? "Cancel" : "+ Add Contract"}
          </SecondaryBtn>
        </div>

        {showContractForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              contractMut.mutate(contractForm);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              padding: 16,
              background: "#f8fafc",
              borderRadius: 8,
            }}
          >
            <Field label="Type" required>
              <input
                required
                style={{ ...inputCss, width: 140 }}
                value={contractForm.contract_type}
                onChange={(e) =>
                  setContractForm((f) => ({ ...f, contract_type: e.target.value }))
                }
                placeholder="e.g. permanent"
              />
            </Field>
            <Field label="Start Date" required>
              <input
                type="date"
                required
                style={{ ...inputCss, width: 140 }}
                value={contractForm.start_date}
                onChange={(e) =>
                  setContractForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                style={{ ...inputCss, width: 140 }}
                value={contractForm.end_date ?? ""}
                onChange={(e) =>
                  setContractForm((f) => ({
                    ...f,
                    end_date: e.target.value || undefined,
                  }))
                }
              />
            </Field>
            <Field label="Salary (ZAR)">
              <input
                type="number"
                min={0}
                style={{ ...inputCss, width: 120 }}
                value={contractForm.salary ?? ""}
                onChange={(e) =>
                  setContractForm((f) => ({
                    ...f,
                    salary: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </Field>
            <div style={{ alignSelf: "flex-end" }}>
              <PrimaryBtn type="submit" disabled={contractMut.isPending}>
                {contractMut.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
            </div>
          </form>
        )}

        <DataTable
          columns={["Type", "Start", "End", "Salary"]}
          isEmpty={!contracts || contracts.length === 0}
          emptyMessage="No contracts recorded"
        >
          {(contracts ?? []).map((c) => (
            <TR key={c.id}>
              <TD>{c.contract_type}</TD>
              <TD>{c.start_date}</TD>
              <TD>{c.end_date ?? "Open-ended"}</TD>
              <TD>
                {c.salary != null
                  ? `ZAR ${Number(c.salary).toLocaleString()}`
                  : "—"}
              </TD>
            </TR>
          ))}
        </DataTable>
      </Card>

      {/* ---- Attendance (SR-F-018) ---- */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <SectionLabel>Attendance</SectionLabel>
          <SecondaryBtn onClick={() => setShowAttendanceForm((v) => !v)}>
            {showAttendanceForm ? "Cancel" : "+ Record Attendance"}
          </SecondaryBtn>
        </div>

        {showAttendanceForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              attendanceMut.mutate(attendanceForm);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              padding: 16,
              background: "#f8fafc",
              borderRadius: 8,
            }}
          >
            <Field label="Date" required>
              <input
                type="date"
                required
                style={{ ...inputCss, width: 140 }}
                value={attendanceForm.attendance_date}
                onChange={(e) =>
                  setAttendanceForm((f) => ({
                    ...f,
                    attendance_date: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Session">
              <select
                style={{ ...selectCss, width: 120 }}
                value={attendanceForm.session ?? "full"}
                onChange={(e) =>
                  setAttendanceForm((f) => ({
                    ...f,
                    session: e.target.value as CreateAttendanceBody["session"],
                  }))
                }
              >
                <option value="full">Full Day</option>
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                style={{ ...selectCss, width: 120 }}
                value={attendanceForm.status ?? "present"}
                onChange={(e) =>
                  setAttendanceForm((f) => ({
                    ...f,
                    status: e.target.value as CreateAttendanceBody["status"],
                  }))
                }
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </Field>
            <div style={{ alignSelf: "flex-end" }}>
              <PrimaryBtn type="submit" disabled={attendanceMut.isPending}>
                {attendanceMut.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
            </div>
          </form>
        )}

        <DataTable
          columns={["Date", "Session", "Status"]}
          isEmpty={!attendance || attendance.length === 0}
          emptyMessage="No attendance records"
        >
          {(attendance ?? []).map((a) => (
            <TR key={a.id}>
              <TD>{a.attendance_date}</TD>
              <TD style={{ textTransform: "capitalize" }}>
                {a.session === "full" ? "Full Day" : a.session.toUpperCase()}
              </TD>
              <TD>
                <Badge
                  variant={
                    a.status === "present"
                      ? "success"
                      : a.status === "absent"
                        ? "danger"
                        : a.status === "late"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </Badge>
              </TD>
            </TR>
          ))}
        </DataTable>
      </Card>

      {/* ---- Appraisals ---- */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <SectionLabel>Appraisals</SectionLabel>
          <SecondaryBtn onClick={() => setShowAppraisalForm((v) => !v)}>
            {showAppraisalForm ? "Cancel" : "+ Add Appraisal"}
          </SecondaryBtn>
        </div>

        {showAppraisalForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              appraisalMut.mutate(appraisalForm);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              padding: 16,
              background: "#f8fafc",
              borderRadius: 8,
            }}
          >
            <Field label="Period" required>
              <input
                required
                style={{ ...inputCss, width: 140 }}
                value={appraisalForm.period}
                onChange={(e) =>
                  setAppraisalForm((f) => ({ ...f, period: e.target.value }))
                }
                placeholder="e.g. 2025-Q4"
              />
            </Field>
            <Field label="Rating (1–5)">
              <input
                type="number"
                min={1}
                max={5}
                style={{ ...inputCss, width: 80 }}
                value={appraisalForm.rating ?? ""}
                onChange={(e) =>
                  setAppraisalForm((f) => ({
                    ...f,
                    rating: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </Field>
            <Field label="Appraised By">
              <input
                style={{ ...inputCss, width: 160 }}
                value={appraisalForm.appraised_by ?? ""}
                onChange={(e) =>
                  setAppraisalForm((f) => ({
                    ...f,
                    appraised_by: e.target.value || undefined,
                  }))
                }
              />
            </Field>
            <Field label="Comments">
              <input
                style={{ ...inputCss, width: 240 }}
                value={appraisalForm.comments ?? ""}
                onChange={(e) =>
                  setAppraisalForm((f) => ({
                    ...f,
                    comments: e.target.value || undefined,
                  }))
                }
              />
            </Field>
            <div style={{ alignSelf: "flex-end" }}>
              <PrimaryBtn type="submit" disabled={appraisalMut.isPending}>
                {appraisalMut.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
            </div>
          </form>
        )}

        <DataTable
          columns={["Period", "Rating", "Comments", "Appraised By"]}
          isEmpty={!appraisals || appraisals.length === 0}
          emptyMessage="No appraisals recorded"
        >
          {(appraisals ?? []).map((a) => (
            <TR key={a.id}>
              <TD>{a.period}</TD>
              <TD title={`${a.rating ?? "—"}/5`}>
                {RATING_STARS(a.rating)}
              </TD>
              <TD>{a.comments ?? "—"}</TD>
              <TD>{a.appraised_by ?? "—"}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
