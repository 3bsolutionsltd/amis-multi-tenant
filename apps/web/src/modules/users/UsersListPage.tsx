import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listUsers, updateUser, VALID_ROLES, type User } from "./users.api";
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
} from "../../lib/ui";

export function UsersListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [roleFilter, setRoleFilter] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", { roleFilter }],
    queryFn: () => listUsers({ role: roleFilter || undefined }),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { role?: (typeof VALID_ROLES)[number]; isActive?: boolean };
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
    setEditRole(user.role);
    setEditError(null);
  }

  function saveEdit() {
    if (!editingUser) return;
    updateMut.mutate({
      id: editingUser.id,
      body: { role: editRole as (typeof VALID_ROLES)[number] },
    });
  }

  function toggleActive(user: User) {
    updateMut.mutate({ id: user.id, body: { isActive: !user.is_active } });
  }

  const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

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
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={selectCss}
        >
          <option value="">All Roles</option>
          {VALID_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        headers={["Email", "Role", "Status", "Created", "Actions"]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="👥"
        emptyTitle="No users found"
        emptyDescription="Adjust the role filter or create a new user."
        colCount={5}
      >
        {data?.map((user) => (
          <TR key={user.id}>
            <TD>
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {user.email}
              </span>
            </TD>
            <TD>
              <Badge label={user.role} color="blue" />
            </TD>
            <TD>
              <Badge
                label={user.is_active ? "Active" : "Inactive"}
                color={user.is_active ? "green" : "gray"}
              />
            </TD>
            <TD muted>{new Date(user.created_at).toLocaleDateString()}</TD>
            <TD>
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryBtn onClick={() => openEdit(user)}>
                  Edit Role
                </SecondaryBtn>
                {user.is_active ? (
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

      {editingUser && (
        <Modal
          title={`Edit Role — ${editingUser.email}`}
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
          <Field label="Role">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              style={selectCss}
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      )}
    </div>
  );
}
