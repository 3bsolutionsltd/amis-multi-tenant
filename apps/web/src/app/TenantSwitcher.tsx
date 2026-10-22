import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/apiBaseUrl";

const API_URL = API_BASE_URL;

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
    if (localStorage.getItem("amis_dev_role") !== "platform_admin") return;

    fetch(`${API_URL}/tenants?limit=100`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data?.data)) setTenants(data.data); })
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
