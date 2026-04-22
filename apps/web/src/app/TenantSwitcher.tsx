import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface TenantOption {
  id: string;
  slug: string;
  name: string;
}

export function TenantSwitcher() {
  const qc = useQueryClient();
  const current = localStorage.getItem("amis_tenant_id") ?? "";
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/auth/tenants`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    localStorage.setItem("amis_tenant_id", e.target.value);
    qc.clear();
    window.location.href = "/";
  }

  if (tenants.length === 0) return null;

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
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
