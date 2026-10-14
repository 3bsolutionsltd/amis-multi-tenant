import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createUser, listRoles, VALID_ROLES } from "./users.api";
import { useConfig } from "../../app/ConfigProvider";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";
import { UserRolesField } from "./UserRolesField";

export function UserCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const { departments } = useConfig();
  const { data: roleData } = useQuery({ queryKey: ["user-roles"], queryFn: listRoles });
  const roleOptions = Array.from(new Set([...VALID_ROLES, ...(roleData?.data ?? [])]));

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "registrar",
    roles: ["registrar"],
    department: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser({
        email: form.email,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        role: form.role,
        roles: form.roles,
        department: form.roles.includes("hod") ? form.department || undefined : undefined,
      });
      navigate("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="New User" back={{ label: "Users", to: "/admin-studio/users" }} />
      <Card padding="24px" style={{ maxWidth: 480 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Field label="First Name">
            <input
              type="text"
              autoComplete="given-name"
              style={inputCss}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </Field>

          <Field label="Last Name">
            <input
              type="text"
              autoComplete="family-name"
              style={inputCss}
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Field>

          <Field label="Email" required>
            <input
              required
              type="email"
              autoComplete="off"
              style={inputCss}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>

          <div
            style={{
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 6,
              fontSize: 13,
              color: "#1e40af",
            }}
          >
            A welcome email will be sent to this address with a link to set up their password (valid 48 hours).
          </div>

          <UserRolesField
            availableRoles={roleOptions}
            roles={form.roles}
            primaryRole={form.role}
            onRolesChange={(roles) => setForm((f) => ({ ...f, roles }))}
            onPrimaryRoleChange={(role) => setForm((f) => ({ ...f, role }))}
          />

          {form.roles.includes("hod") && (
            <Field label="Department" required>
              <select
                required
                style={selectCss}
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              >
                <option value="">— Select department —</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </Field>
          )}

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
