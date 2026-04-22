import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  createUser,
  listUsers,
  updateUser,
  VALID_ROLES,
  type User,
} from "../modules/users/users.api";
import { C, inputCss, selectCss } from "../lib/ui";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.gray200}`,
  borderRadius: 12,
  padding: 24,
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:      { bg: C.purpleBg,   text: C.purpleText  },
  registrar:  { bg: C.blueBg,     text: C.blueText    },
  hod:        { bg: C.indigoBg,   text: C.indigoText  },
  instructor: { bg: C.cyanBg,     text: C.cyanText    },
  finance:    { bg: C.greenBg,    text: C.greenText   },
  principal:  { bg: C.yellowBg,   text: C.yellowText  },
  dean:       { bg: C.pinkBg,     text: C.pinkText    },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? { bg: C.gray100, text: C.gray600 };
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        textTransform: "capitalize",
      }}
    >
      {role}
    </span>
  );
}

// ------------------------------------------------------------------ main page

export function StudioUsersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-users", roleFilter],
    queryFn: () =>
      listUsers({ role: roleFilter || undefined, limit: 100 }),
    staleTime: 30_000,
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
      void qc.invalidateQueries({ queryKey: ["studio-users"] });
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
    if (
      !window.confirm(
        `${user.is_active ? "Deactivate" : "Activate"} "${user.email}"?`,
      )
    )
      return;
    updateMut.mutate({ id: user.id, body: { isActive: !user.is_active } });
  }

  const users = data?.data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: C.gray900 }}>
            Users &amp; Roles
          </h2>
          <p style={{ margin: 0, color: C.gray500, fontSize: 14 }}>
            Manage staff accounts for your institute.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/users/new")}
            style={{
              padding: "9px 20px",
              background: C.blue,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New User
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ ...selectCss, maxWidth: 200 }}
        >
          <option value="">All Roles</option>
          {VALID_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div style={cardStyle}>
        {isLoading ? (
          <p style={{ color: C.gray400 }}>Loading users…</p>
        ) : users.length === 0 ? (
          <p style={{ color: C.gray400, fontSize: 14 }}>No users found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.gray100}` }}>
                {["Email", "Role", "Status", "Created", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.gray500,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                  <td style={{ padding: "11px 12px", fontWeight: 600, color: C.gray900 }}>
                    {u.email}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <RoleBadge role={u.role} />
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: u.is_active ? C.greenBg : C.redBg,
                        color: u.is_active ? C.greenText : C.redText,
                      }}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", color: C.gray500, fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openEdit(u)}
                        style={{
                          padding: "4px 12px",
                          background: C.gray100,
                          border: `1px solid ${C.gray300}`,
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Role
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          padding: "4px 12px",
                          background: u.is_active ? C.redBg : C.greenBg,
                          border: `1px solid ${u.is_active ? "#fca5a5" : "#86efac"}`,
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          color: u.is_active ? C.redText : C.greenText,
                          fontWeight: 600,
                        }}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 28,
              width: 380,
              boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 17, color: C.gray900 }}>
              Edit Role
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: C.gray500 }}>
              {editingUser.email}
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Role</label>
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
            </div>

            {editError && (
              <div
                style={{
                  background: C.redBg,
                  color: C.redText,
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={saveEdit}
                disabled={updateMut.isPending}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: updateMut.isPending ? C.gray400 : C.blue,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: updateMut.isPending ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                {updateMut.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: C.gray100,
                  border: `1px solid ${C.gray300}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
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
