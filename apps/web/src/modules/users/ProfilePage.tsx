import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getMe, changeMyPassword } from "./users.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  PrimaryBtn,
  Badge,
  ErrorBanner,
} from "../../lib/ui";

export function ProfilePage() {
  ensureGlobalCss();

  // ---- state -------------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]           = useState<string | null>(null);

  // ---- query -------------------------------------------------------
  const { data: me, isLoading } = useQuery({
    queryKey: ["me-profile"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  // ---- mutation ----------------------------------------------------
  const changePwdMut = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      changeMyPassword(current, next),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
      setSuccessMsg("Password changed successfully.");
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Failed to change password");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!currentPassword) {
      setFormError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    changePwdMut.mutate({ current: currentPassword, next: newPassword });
  }

  // ---- render ------------------------------------------------------
  return (
    <div>
      <PageHeader title="My Profile" />

      {/* Profile info */}
      <Card padding="24px" style={{ maxWidth: 520, marginBottom: 24 }}>
        {isLoading ? (
          <p style={{ color: "#6b7280", margin: 0 }}>Loading…</p>
        ) : me ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>EMAIL</div>
              <div style={{ fontWeight: 600, color: "#111827" }}>{me.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>ROLE</div>
              <Badge label={me.role} color="blue" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>LAST LOGIN</div>
              <div style={{ fontSize: 14, color: "#374151" }}>
                {me.lastLoginAt
                  ? new Date(me.lastLoginAt).toLocaleString()
                  : "Just now"}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Change password */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>
        Change Password
      </h3>
      <Card padding="24px" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {successMsg && (
            <div
              style={{
                background: "#d1fae5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 14,
              }}
            >
              {successMsg}
            </div>
          )}

          {formError && <ErrorBanner message={formError} />}

          <Field label="Current Password">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Your current password"
              style={inputCss}
              autoComplete="current-password"
            />
          </Field>

          <Field label="New Password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={inputCss}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Confirm New Password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              style={inputCss}
              autoComplete="new-password"
            />
          </Field>

          <div>
            <PrimaryBtn type="submit" disabled={changePwdMut.isPending}>
              {changePwdMut.isPending ? "Saving…" : "Change Password"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
