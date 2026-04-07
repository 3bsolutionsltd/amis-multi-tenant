import { useQueryClient } from "@tanstack/react-query";

const TENANTS = [
  { id: "10e575a2-2e59-437b-b251-c5b906a482d8", name: "Greenfield VTI" },
  {
    id: "b6c79654-fa01-4598-90ad-5467760e57e2",
    name: "Riverside Tech College",
  },
];

export function TenantSwitcher() {
  const qc = useQueryClient();
  const current = localStorage.getItem("amis_tenant_id") ?? TENANTS[0].id;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    localStorage.setItem("amis_tenant_id", e.target.value);
    qc.clear();
    // Force a page reload so ConfigProvider re-fetches with the new tenant
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
      Tenant:
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
        {TENANTS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
