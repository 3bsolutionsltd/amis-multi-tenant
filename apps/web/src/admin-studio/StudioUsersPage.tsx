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
  admin:                { bg: C.purpleBg,   text: C.purpleText  },
  registrar:            { bg: C.blueBg,     text: C.blueText    },
  hod:                  { bg: C.indigoBg,   text: C.indigoText  },
  instructor:           { bg: C.cyanBg,     text: C.cyanText    },
  finance:              { bg: C.greenBg,    text: C.greenText   },
  principal:            { bg: C.yellowBg,   text: C.yellowText  },
  dean:                 { bg: C.pinkBg,     text: C.pinkText    },
  procurement_officer:  { bg: "#fff7ed",    text: "#c2410c"     },
  inventory_manager:    { bg: "#ecfdf5",    text: "#047857"     },
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

// ------------------------------------------------------------------ permission matrix

type Access = "full" | "read" | "none";
const FULL = "full" as const;
const READ = "read" as const;
const NONE = "none" as const;

const ROLES_SHORT = ["admin", "registrar", "hod", "instructor", "finance", "principal", "dean", "proc.", "inv."] as const;

type MatrixRow = { module: string; access: Access[] };

// Illustrative only (not wired to real permission enforcement) — kept in sync
// with the modules actually registered in routes.tsx (issue #301).
const MATRIX: MatrixRow[] = [
  { module: "Students",             access: [FULL, FULL, READ, READ, NONE, READ, READ, NONE, NONE] },
  { module: "Admissions",           access: [FULL, FULL, NONE, NONE, NONE, READ, NONE, NONE, NONE] },
  { module: "Term Registrations",   access: [FULL, FULL, READ, READ, NONE, READ, READ, NONE, NONE] },
  { module: "Programmes",           access: [FULL, FULL, READ, READ, NONE, READ, READ, NONE, NONE] },
  { module: "Marks",                access: [FULL, NONE, FULL, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Results",              access: [FULL, READ, READ, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Finance / Fees",       access: [FULL, NONE, NONE, NONE, FULL, READ, NONE, NONE, NONE] },
  { module: "Procurement",          access: [FULL, NONE, NONE, NONE, NONE, READ, NONE, FULL, NONE] },
  { module: "Inventory",            access: [FULL, NONE, NONE, NONE, NONE, READ, NONE, READ, FULL] },
  { module: "Stores / SRQ / PCV",   access: [FULL, NONE, NONE, NONE, NONE, READ, NONE, FULL, FULL] },
  { module: "Staff / HR",           access: [FULL, READ, READ, NONE, NONE, READ, READ, NONE, NONE] },
  { module: "Users / IAM",          access: [FULL, NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE] },
  { module: "Timetable",            access: [FULL, FULL, READ, READ, NONE, READ, READ, NONE, NONE] },
  { module: "Attendance",           access: [FULL, READ, READ, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Clearance",            access: [FULL, FULL, READ, NONE, FULL, READ, READ, NONE, NONE] },
  { module: "Industrial Training",  access: [FULL, READ, FULL, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Field Placements",     access: [FULL, READ, FULL, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Student Projects",     access: [FULL, READ, FULL, FULL, NONE, READ, READ, NONE, NONE] },
  { module: "Alumni",               access: [FULL, FULL, READ, NONE, NONE, READ, READ, NONE, NONE] },
  { module: "Analytics",            access: [FULL, READ, READ, NONE, READ, FULL, FULL, NONE, NONE] },
  { module: "Reports",              access: [FULL, FULL, FULL, READ, FULL, FULL, FULL, READ, READ] },
  { module: "Admin Studio",         access: [FULL, NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE] },
];

const CYCLE: Access[] = ["none", "read", "full"];

const ACCESS_DISPLAY: Record<Access, { icon: string; color: string; label: string }> = {
  full: { icon: "✅", color: C.greenText,  label: "Full"      },
  read: { icon: "👁️", color: C.blueText,   label: "Read-only" },
  none: { icon: "—",  color: C.gray400,    label: "None"      },
};

function PermissionMatrix() {
  const [matrix, setMatrix] = useState<MatrixRow[]>(
    MATRIX.map((r) => ({ ...r, access: [...r.access] }))
  );
  const [copied, setCopied] = useState(false);

  function cycleCell(rowIdx: number, colIdx: number) {
    setMatrix((prev) =>
      prev.map((row, ri) => {
        if (ri !== rowIdx) return row;
        const next = [...row.access];
        const cur = CYCLE.indexOf(next[colIdx]);
        next[colIdx] = CYCLE[(cur + 1) % CYCLE.length];
        return { ...row, access: next };
      })
    );
  }

  function resetMatrix() {
    setMatrix(MATRIX.map((r) => ({ ...r, access: [...r.access] })));
  }

  function copyJson() {
    const json = JSON.stringify(
      matrix.map((r) => ({ module: r.module, access: r.access })),
      null,
      2
    );
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, color: C.gray500, margin: 0, flex: 1 }}>
          Click any cell to cycle: <strong>— None</strong> → <strong>👁️ Read</strong> → <strong>✅ Full</strong>.
          &nbsp;<em>(proc. = procurement_officer, inv. = inventory_manager)</em>
        </p>
        <button
          onClick={resetMatrix}
          style={{
            padding: "5px 14px",
            fontSize: 12,
            background: C.gray100,
            border: `1px solid ${C.gray300}`,
            borderRadius: 6,
            cursor: "pointer",
            color: C.gray700,
            fontWeight: 600,
          }}
        >
          Reset
        </button>
        <button
          onClick={copyJson}
          style={{
            padding: "5px 14px",
            fontSize: 12,
            background: copied ? C.greenBg : C.blueBg,
            border: `1px solid ${copied ? "#86efac" : "#93c5fd"}`,
            borderRadius: 6,
            cursor: "pointer",
            color: copied ? C.greenText : C.blueText,
            fontWeight: 600,
          }}
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
              <th style={{ textAlign: "left", padding: "8px 14px", fontWeight: 700, color: C.gray700 }}>
                Module
              </th>
              {ROLES_SHORT.map((r) => (
                <th
                  key={r}
                  style={{
                    textAlign: "center",
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 11,
                    color: C.gray500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr
                key={row.module}
                style={{
                  borderBottom: `1px solid ${C.gray100}`,
                  background: ri % 2 === 0 ? "#fff" : C.gray50,
                }}
              >
                <td style={{ padding: "9px 14px", fontWeight: 600, color: C.gray900 }}>
                  {row.module}
                </td>
                {row.access.map((a, ai) => {
                  const d = ACCESS_DISPLAY[a];
                  return (
                    <td
                      key={ai}
                      title={`Click to change (${d.label})`}
                      onClick={() => cycleCell(ri, ai)}
                      style={{
                        textAlign: "center",
                        padding: "9px 10px",
                        color: d.color,
                        cursor: "pointer",
                        userSelect: "none",
                        borderRadius: 4,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableCellElement).style.background = C.gray100;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableCellElement).style.background = "";
                      }}
                    >
                      {d.icon}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ main page

export function StudioUsersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"users" | "matrix">("users");
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
        `${user.isActive ? "Deactivate" : "Activate"} "${user.email}"?`,
      )
    )
      return;
    updateMut.mutate({ id: user.id, body: { isActive: !user.isActive } });
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

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `1px solid ${C.gray200}`,
          marginBottom: 20,
        }}
      >
        {(["users", "matrix"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              background: "none",
              border: "none",
              borderBottom: activeTab === t ? `2px solid ${C.blue}` : "2px solid transparent",
              color: activeTab === t ? C.blue : C.gray500,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t === "users" ? "Users" : "Permission Matrix"}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <>
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
                        background: u.isActive ? C.greenBg : C.redBg,
                        color: u.isActive ? C.greenText : C.redText,
                      }}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", color: C.gray500, fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
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
                          background: u.isActive ? C.redBg : C.greenBg,
                          border: `1px solid ${u.isActive ? "#fca5a5" : "#86efac"}`,
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          color: u.isActive ? C.redText : C.greenText,
                          fontWeight: 600,
                        }}
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </> /* end users tab */
      )}

      {activeTab === "matrix" && <PermissionMatrix />}

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
