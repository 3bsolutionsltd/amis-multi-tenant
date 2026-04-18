import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/apiFetch";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  contactEmail: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  createdAt: string;
}

interface TenantsResponse {
  data: Tenant[];
  total: number;
  page: number;
  limit: number;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  marginBottom: 4,
};

export function TenantManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<TenantsResponse>("/tenants?limit=100");
      setTenants(res.data);
      setTotal(res.total);
    } catch {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/tenants", {
        method: "POST",
        body: JSON.stringify({
          slug: form.get("slug"),
          name: form.get("name"),
          contactEmail: form.get("contactEmail") || undefined,
          address: form.get("address") || undefined,
          phone: form.get("phone") || undefined,
          logoUrl: form.get("logoUrl") || undefined,
        }),
      });
      setCreating(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create tenant";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, form: FormData) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/tenants/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name") || undefined,
          contactEmail: form.get("contactEmail") || null,
          address: form.get("address") || null,
          phone: form.get("phone") || null,
          logoUrl: form.get("logoUrl") || null,
          isActive: form.get("isActive") === "on",
        }),
      });
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update tenant";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Create Tenant</h2>
        <TenantForm
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          saving={saving}
        />
        {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  if (editing) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Edit Tenant</h2>
        <TenantForm
          tenant={editing}
          onSubmit={(form) => handleUpdate(editing.id, form)}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
        {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Tenants ({total})
        </h2>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Create Tenant
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading...</p>
      ) : tenants.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No tenants found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>Name</th>
              <th style={{ padding: "10px 12px" }}>Slug</th>
              <th style={{ padding: "10px 12px" }}>Email</th>
              <th style={{ padding: "10px 12px" }}>Active</th>
              <th style={{ padding: "10px 12px" }}>Created</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{t.name}</td>
                <td style={{ padding: "10px 12px", color: "#64748b", fontFamily: "monospace" }}>
                  {t.slug}
                </td>
                <td style={{ padding: "10px 12px" }}>{t.contactEmail ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: t.isActive ? "#dcfce7" : "#fee2e2",
                      color: t.isActive ? "#166534" : "#991b1b",
                    }}
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#64748b" }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => setEditing(t)}
                    style={{
                      padding: "4px 12px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ form

function TenantForm({
  tenant,
  onSubmit,
  onCancel,
  saving,
}: {
  tenant?: Tenant;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}
    >
      {!tenant && (
        <div>
          <label style={labelStyle}>Slug</label>
          <input
            name="slug"
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            title="lowercase alphanumeric with hyphens"
            style={inputStyle}
          />
        </div>
      )}

      <div>
        <label style={labelStyle}>Name</label>
        <input name="name" required defaultValue={tenant?.name} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Contact Email</label>
        <input name="contactEmail" type="email" defaultValue={tenant?.contactEmail ?? ""} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Address</label>
        <input name="address" defaultValue={tenant?.address ?? ""} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Phone</label>
        <input name="phone" defaultValue={tenant?.phone ?? ""} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Logo URL</label>
        <input name="logoUrl" type="url" defaultValue={tenant?.logoUrl ?? ""} style={inputStyle} />
      </div>

      {tenant && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={tenant.isActive}
            id="isActive"
          />
          <label htmlFor="isActive" style={{ fontSize: 14 }}>Active</label>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "8px 20px",
            background: saving ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : tenant ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
