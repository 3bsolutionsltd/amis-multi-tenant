import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listRoles, listUsers, updateUser, VALID_ROLES, type UpdateUserBody, type User } from "./users.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  DataTable,
  TR,
  TD,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  SuccessBtn,
  Modal,
  Field,
  selectCss,
  ErrorBanner,
  Pagination,
} from "../../lib/ui";
import { useConfig } from "../../app/ConfigProvider";
import { UserRolesField } from "./UserRolesField";

export function UsersListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { departments: configuredDepartments } = useConfig();
  const departments = configuredDepartments;

  const [params, setParams] = useSearchParams();
  const roleFilter = params.get("role") ?? "";
  const searchFilter = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1");

  function setRoleFilter(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set("role", v);
      else n.delete("role");
      n.set("page", "1");
      return n;
    });
  }
  function setSearchFilter(v: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set("search", v);
      else n.delete("search");
      n.set("page", "1");
      return n;
    });
  }
  function setPage(v: number) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("page", String(v));
      return n;
    });
  }

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDepartment, setEditDepartment] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", { roleFilter, searchFilter, page }],
    queryFn: () =>
      listUsers({ role: roleFilter || undefined, search: searchFilter || undefined, page, limit: 20 }),
  });
  const { data: roleData } = useQuery({ queryKey: ["user-roles"], queryFn: listRoles });
  const roleOptions = Array.from(new Set([...VALID_ROLES, ...(roleData?.data ?? [])]));

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateUserBody;
    }) => updateUser(id, body),
    onSuccess: () => {
      setEditingUser(null);
      setEditError(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : "Update failed");
    },
  });

  function openEdit(user: User) {
    setEditingUser(user);
    setEditFirstName(user.firstName ?? "");
    setEditLastName(user.lastName ?? "");
    setEditRole(user.role);
    setEditRoles(user.roles?.length ? user.roles : [user.role]);
    setEditDepartment(user.department ?? "");
    setEditError(null);
  }

  function saveEdit() {
    if (!editingUser) return;
    updateMut.mutate({
      id: editingUser.id,
      body: {
        firstName: editFirstName.trim() || undefined,
        lastName: editLastName.trim() || undefined,
        role: editRole,
        roles: editRoles,
        department: editRoles.includes("hod") ? editDepartment || null : null,
      },
    });
  }

  function toggleActive(user: User) {
    updateMut.mutate({ id: user.id, body: { isActive: !user.isActive } });
  }

  const isEmpty = !isLoading && !error && (data?.data.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Users"
        action={
          <PrimaryBtn onClick={() => navigate("/users/new")}>
            + New User
          </PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load users." />}

      <FilterBar>
        <input
          type="text"
          placeholder="Search by name or email…"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            padding: "6px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 220,
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={selectCss}
        >
          <option value="">All Roles</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={["Name / Email", "Responsibilities", "Status", "Created", "Actions"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="👥"
        emptyTitle="No users found"
        emptyDescription="Adjust the role filter or create a new user."
        colCount={5}
      >
        {data?.data.map((user) => (
          <TR key={user.id}>
            <TD>
              <span
                style={{ fontWeight: 600, color: "#2563eb", cursor: "pointer" }}
                onClick={() => navigate(`/users/${user.id}`)}
              >
                {user.firstName || user.lastName
                  ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                  : user.email}
              </span>
              {(user.firstName || user.lastName) && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>{user.email}</div>
              )}
            </TD>
            <TD>
              {(user.roles?.length ? user.roles : [user.role]).map((role) => (
                <Badge
                  key={role}
                  label={`${role}${role === user.role ? " (primary)" : ""}`}
                  color="blue"
                />
              ))}
            </TD>
            <TD>
              <Badge
                label={user.isActive ? "Active" : "Inactive"}
                color={user.isActive ? "green" : "gray"}
              />
            </TD>
            <TD muted>{new Date(user.createdAt).toLocaleDateString()}</TD>
            <TD>
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryBtn onClick={() => openEdit(user)}>
                  Edit Responsibilities
                </SecondaryBtn>
                {user.isActive ? (
                  <DangerBtn onClick={() => toggleActive(user)}>
                    Deactivate
                  </DangerBtn>
                ) : (
                  <SuccessBtn onClick={() => toggleActive(user)}>
                    Activate
                  </SuccessBtn>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </DataTable>

      <Pagination
        page={page}
        hasMore={(data?.data.length ?? 0) >= 20}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(page + 1)}
      />

      {editingUser && (
        <Modal
          title={`Edit User — ${editingUser.email}`}
          onClose={() => setEditingUser(null)}
          footer={
            <>
              <PrimaryBtn onClick={saveEdit} disabled={updateMut.isPending}>
                {updateMut.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
              <SecondaryBtn onClick={() => setEditingUser(null)}>
                Cancel
              </SecondaryBtn>
            </>
          }
        >
          {editError && <ErrorBanner message={editError} />}
          <Field label="First Name">
            <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} style={{ ...selectCss, width: "100%" }} />
          </Field>
          <Field label="Last Name">
            <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} style={{ ...selectCss, width: "100%" }} />
          </Field>
          <UserRolesField
            availableRoles={roleOptions}
            roles={editRoles}
            primaryRole={editRole}
            onRolesChange={setEditRoles}
            onPrimaryRoleChange={setEditRole}
          />
          {editRoles.includes("hod") && (
            <Field label="Department" required>
              <select
                required
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                style={selectCss}
              >
                <option value="">— Select department —</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}
