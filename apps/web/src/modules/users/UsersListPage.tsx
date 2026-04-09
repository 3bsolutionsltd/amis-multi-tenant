import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listUsers, updateUser, VALID_ROLES, type User } from "./users.api";
import { useConfig } from "../../app/ConfigProvider";

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: active ? "#16a34a" : "#6b7280",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function UsersListPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const primary = config?.branding?.primaryColor ?? "#2563EB";
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0 }}>Users</h2>
        <button
          onClick={() => navigate("/users/new")}
          style={{
            backgroundColor: primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + New User
        </button>
      </div>

      {/* Role filter */}
      <div style={{ marginBottom: 20 }}>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "7px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <option value="">All Roles</option>
          {VALID_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && <p style={{ color: "#dc2626" }}>Failed to load users.</p>}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Email", "Role", "Status", "Created", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "24px 12px",
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                    No users found.
                  </td>
                </tr>
              )}
              {data.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px" }}>{user.email}</td>
                  <td style={{ padding: "10px 12px" }}>{user.role}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <ActiveBadge active={user.is_active} />
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => openEdit(user)}
                      style={{
                        marginRight: 8,
                        padding: "4px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 5,
                        background: "none",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Edit Role
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={updateMut.isPending}
                      style={{
                        padding: "4px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 5,
                        background: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: user.is_active ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit role modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              padding: 28,
              minWidth: 340,
              boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Edit Role — {editingUser.email}</h3>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {editError && (
              <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
                {editError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={saveEdit}
                disabled={updateMut.isPending}
                style={{
                  backgroundColor: primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
