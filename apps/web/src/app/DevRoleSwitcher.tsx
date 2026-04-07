import { useQueryClient } from "@tanstack/react-query";

const ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
];

export function DevRoleSwitcher() {
  const qc = useQueryClient();
  const current = localStorage.getItem("amis_dev_role") ?? "admin";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    localStorage.setItem("amis_dev_role", e.target.value);
    qc.clear();
    window.location.href = "/";
  }

  return (
    <label
      style={{
        fontSize: 13,
        color: "#fff",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      Role:
      <select
        defaultValue={current}
        onChange={handleChange}
        style={{
          fontSize: 13,
          padding: "2px 6px",
          borderRadius: 4,
          border: "none",
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
