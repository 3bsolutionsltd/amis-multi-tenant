import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listStaff,
  deleteStaff,
  createStaff,
  type CreateStaffBody,
  type StaffProfile,
} from "./staff.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

function StaffModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState<CreateStaffBody>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    staff_number: "",
    department: "",
    designation: "",
    employment_type: undefined,
    join_date: "",
    salary: undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: keyof CreateStaffBody, v: string) {
    setForm((f) => ({ ...f, [k]: v || undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: CreateStaffBody = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        staff_number: form.staff_number || undefined,
        department: form.department || undefined,
        designation: form.designation || undefined,
        employment_type: form.employment_type || undefined,
        join_date: form.join_date || undefined,
        salary: form.salary ? Number(form.salary) : undefined,
      };
      const created = await createStaff(body);
      onSaved(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  };
  const modal: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    padding: 28,
    width: "100%",
    maxWidth: 560,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    maxHeight: "90vh",
    overflowY: "auto",
  };

  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modal}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
          New Staff Member
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="First Name" required>
              <input
                required
                style={inputCss}
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </Field>
            <Field label="Last Name" required>
              <input
                required
                style={inputCss}
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Staff Number">
              <input
                style={inputCss}
                value={form.staff_number ?? ""}
                onChange={(e) => set("staff_number", e.target.value)}
                placeholder="e.g. STF001"
              />
            </Field>
            <Field label="Employment Type">
              <select
                style={selectCss}
                value={form.employment_type ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    employment_type: e.target.value as CreateStaffBody["employment_type"] || undefined,
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
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Department">
              <input
                style={inputCss}
                value={form.department ?? ""}
                onChange={(e) => set("department", e.target.value)}
                placeholder="e.g. ICT"
              />
            </Field>
            <Field label="Designation">
              <input
                style={inputCss}
                value={form.designation ?? ""}
                onChange={(e) => set("designation", e.target.value)}
                placeholder="e.g. Lecturer"
              />
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Email">
              <input
                type="email"
                style={inputCss}
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                style={inputCss}
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Join Date">
              <input
                type="date"
                style={inputCss}
                value={form.join_date ?? ""}
                onChange={(e) => set("join_date", e.target.value)}
              />
            </Field>
            <Field label="Salary (UGX)">
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
          {error && <ErrorBanner message={error} />}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <SecondaryBtn type="button" onClick={onClose}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StaffListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ["staff", search, deptFilter],
    queryFn: () =>
      listStaff({
        search: search || undefined,
        department: deptFilter || undefined,
      }),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deleteStaff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });

  const cols = ["Name", "Staff No.", "Department", "Designation", "Type", "Status", ""];

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage staff profiles, contracts and attendance"
        action={
          <PrimaryBtn onClick={() => navigate("/staff/new")}>+ New Staff</PrimaryBtn>
        }
      />

      {showModal && (
        <StaffModal
          onClose={() => setShowModal(false)}
          onSaved={(id) => navigate(`/staff/${id}`)}
        />
      )}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, staff no…"
        />
        <input
          style={{ ...inputCss, width: 160 }}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          placeholder="Filter by department"
        />
      </FilterBar>

      {error && (
        <ErrorBanner
          message={error instanceof Error ? error.message : "Failed to load staff"}
        />
      )}

      <DataTable
        headers={cols}
        isLoading={isLoading}
        isEmpty={!staff || staff.length === 0}
        emptyTitle="No staff found"
      >
        {(staff ?? []).map((s: StaffProfile) => (
          <TR key={s.id} onClick={() => navigate(`/staff/${s.id}`)}>
            <TD>
              {s.first_name} {s.last_name}
            </TD>
            <TD>{s.staff_number ?? "—"}</TD>
            <TD>{s.department ?? "—"}</TD>
            <TD>{s.designation ?? "—"}</TD>
            <TD>
              {s.employment_type
                ? EMPLOYMENT_LABELS[s.employment_type] ?? s.employment_type
                : "—"}
            </TD>
            <TD>
              <Badge label={s.is_active ? "Active" : "Inactive"} color={s.is_active ? "green" : "gray"} />
            </TD>
            <TD>
              {s.is_active && (
                <SecondaryBtn
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Deactivate ${s.first_name} ${s.last_name}?`)) {
                      deactivateMut.mutate(s.id);
                    }
                  }}
                >
                  Deactivate
                </SecondaryBtn>
              )}
            </TD>
          </TR>
        ))}
      </DataTable>
    </div>
  );
}
