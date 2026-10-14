import { Field, selectCss } from "../../lib/ui";

interface UserRolesFieldProps {
  availableRoles: string[];
  roles: string[];
  primaryRole: string;
  onRolesChange: (roles: string[]) => void;
  onPrimaryRoleChange: (role: string) => void;
}

export function UserRolesField({
  availableRoles,
  roles,
  primaryRole,
  onRolesChange,
  onPrimaryRoleChange,
}: UserRolesFieldProps) {
  const roleOptions = Array.from(new Set([...availableRoles, ...roles]));

  function toggleRole(role: string, checked: boolean) {
    if (checked) {
      onRolesChange(Array.from(new Set([...roles, role])));
      return;
    }

    if (roles.length <= 1) return;
    const nextRoles = roles.filter((assignedRole) => assignedRole !== role);
    onRolesChange(nextRoles);
    if (primaryRole === role) onPrimaryRoleChange(nextRoles[0]);
  }

  return (
    <>
      <Field label="Assigned responsibilities">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {roleOptions.map((role) => (
            <label key={role} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(event) => toggleRole(role, event.target.checked)}
              />
              {role}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Primary responsibility">
        <select
          required
          value={primaryRole}
          onChange={(event) => onPrimaryRoleChange(event.target.value)}
          style={selectCss}
        >
          {roles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
