import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUser,
  getIamAuditLog,
  updateUser,
  resetUserPassword,
  VALID_ROLES,
  type AuditLogEntry,
} from "./users.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  selectCss,
  inputCss,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  SuccessBtn,
  Badge,
  Modal,
  ErrorBanner,
  DataTable,
  TR,
  TD,
} from "../../lib/ui";

const ACTION_LABELS: Record<string, { label: string; color: "blue" | "green" | "red" | "gray" }> = {
  created:        { label: "Created",        color: "blue" },
  role_changed:   { label: "Role Changed",   color: "blue" },
  activated:      { label: "Activated",      color: "green" },
  deactivated:    { label: "Deactivated",    color: "red" },
  password_reset: { label: "Password Reset", color: "gray" },
};

export function UserDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  // ---- state -------------------------------------------------------
  const [showEditRole, setShowEditRole]       = useState(false);
  const [editRole, setEditRole]               = useState("");
  const [editRoleError, setEditRoleError]     = useState<string | null>(null);

  const [showResetPwd, setShowResetPwd]       = useState(false);
  const [newPassword, setNewPassword]         = useState("");
  const [resetPwdError, setResetPwdError]     = useState<string | null>(null);
  const [resetPwdSuccess, setResetPwdSuccess] = useState(false);

  // ---- queries -----------------------------------------------------
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["user-audit", id],
    queryFn: () => getIamAuditLog(id!),
    enabled: !!id,
  });

  // ---- mutations ---------------------------------------------------
  const updateMut = useMutation({
    mutationFn: (body: { role?: (typeof VALID_ROLES)[number]; isActive?: boolean }) =>
      updateUser(id!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user", id] });
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["user-audit", id] });
      setShowEditRole(false);
      setEditRoleError(null);
    },
    onError: (err) => {
      setEditRoleError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const resetPwdMut = useMutation({
    mutationFn: (pwd: string) => resetUserPassword(id!, pwd),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-audit", id] });
      setShowResetPwd(false);
      setNewPassword("");
      setResetPwdError(null);
      setResetPwdSuccess(true);
      setTimeout(() => setResetPwdSuccess(false), 4000);
    },
    onError: (err) => {
      setResetPwdError(err instanceof Error ? err.message : "Reset failed");
    },
  });

  // ---- helpers -----------------------------------------------------
  function openEditRole() {
    if (!user) return;
    setEditRole(user.role);
    setEditRoleError(null);
    setShowEditRole(true);
  }

  function openResetPwd() {
    setNewPassword("");
    setResetPwdError(null);
    setShowResetPwd(true);
  }

  // ---- render ------------------------------------------------------
  if (isLoading) {
    return (
      <div>
        <PageHeader title="User Detail" back={{ label: "Users", to: "/users" }} />
        <p style={{ color: "#6b7280", padding: "24px 0" }}>Loading…</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div>
        <PageHeader title="User Detail" back={{ label: "Users", to: "/users" }} />
        <ErrorBanner message="User not found or you do not have permission to view this account." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={user.email} back={{ label: "Users", to: "/users" }} />

      {resetPwdSuccess && (
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Password has been reset successfully.
        </div>
      )}

      {/* User Info Card */}
      <Card padding="24px" style={{ maxWidth: 600, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>EMAIL</div>
            <div style={{ fontWeight: 600, color: "#111827" }}>{user.email}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>ROLE</div>
            <Badge label={user.role} color="blue" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>STATUS</div>
            <Badge label={user.isActive ? "Active" : "Inactive"} color={user.isActive ? "green" : "gray"} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>CREATED</div>
            <div style={{ fontSize: 14, color: "#374151" }}>
              {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>LAST LOGIN</div>
            <div style={{ fontSize: 14, color: "#374151" }}>
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleString()
                : "Never"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <PrimaryBtn onClick={openEditRole}>Change Role</PrimaryBtn>
          <SecondaryBtn onClick={openResetPwd}>Reset Password</SecondaryBtn>
          {user.isActive ? (
            <DangerBtn
              onClick={() => updateMut.mutate({ isActive: false })}
              disabled={updateMut.isPending}
            >
              Deactivate
            </DangerBtn>
          ) : (
            <SuccessBtn
              onClick={() => updateMut.mutate({ isActive: true })}
              disabled={updateMut.isPending}
            >
              Activate
            </SuccessBtn>
          )}
        </div>
      </Card>

      {/* Audit Log */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>
        Activity Log
      </h3>
      <DataTable
        headers={["Action", "By", "Old Value", "New Value", "Date"]}
        isLoading={auditLoading}
        isEmpty={!auditLoading && (auditData?.data.length ?? 0) === 0}
        emptyIcon="📋"
        emptyTitle="No activity yet"
        emptyDescription="Actions taken on this account will appear here."
        colCount={5}
      >
        {auditData?.data.map((entry: AuditLogEntry) => {
          const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "gray" as const };
          return (
            <TR key={entry.id}>
              <TD>
                <Badge label={meta.label} color={meta.color} />
              </TD>
              <TD muted>{entry.actorEmail ?? "—"}</TD>
              <TD muted>{entry.oldValue ?? "—"}</TD>
              <TD muted>{entry.newValue ?? "—"}</TD>
              <TD muted>{new Date(entry.createdAt).toLocaleString()}</TD>
            </TR>
          );
        })}
      </DataTable>

      {/* Edit Role Modal */}
      {showEditRole && (
        <Modal
          title={`Change Role — ${user.email}`}
          onClose={() => setShowEditRole(false)}
          footer={
            <>
              <PrimaryBtn
                onClick={() =>
                  updateMut.mutate({ role: editRole as (typeof VALID_ROLES)[number] })
                }
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? "Saving…" : "Save"}
              </PrimaryBtn>
              <SecondaryBtn onClick={() => setShowEditRole(false)}>Cancel</SecondaryBtn>
            </>
          }
        >
          {editRoleError && <ErrorBanner message={editRoleError} />}
          <Field label="New Role">
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

      {/* Reset Password Modal */}
      {showResetPwd && (
        <Modal
          title={`Reset Password — ${user.email}`}
          onClose={() => setShowResetPwd(false)}
          footer={
            <>
              <PrimaryBtn
                onClick={() => {
                  if (
                    newPassword.length < 8 ||
                    !/[A-Z]/.test(newPassword) ||
                    !/[0-9]/.test(newPassword)
                  ) {
                    setResetPwdError(
                      "Password must be at least 8 characters and contain at least one uppercase letter and one number.",
                    );
                    return;
                  }
                  resetPwdMut.mutate(newPassword);
                }}
                disabled={resetPwdMut.isPending}
              >
                {resetPwdMut.isPending ? "Resetting…" : "Reset Password"}
              </PrimaryBtn>
              <SecondaryBtn onClick={() => setShowResetPwd(false)}>Cancel</SecondaryBtn>
            </>
          }
        >
          {resetPwdError && <ErrorBanner message={resetPwdError} />}
          <Field label="New Password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters, 1 uppercase, 1 number"
              style={inputCss}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
