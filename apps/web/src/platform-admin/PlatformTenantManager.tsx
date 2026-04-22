import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { C, inputCss } from "../lib/ui";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  contactEmail: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  setupCompleted?: boolean;
  createdAt: string;
}

interface TenantsResponse {
  data: Tenant[];
  total: number;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.gray200}`,
  borderRadius: 10,
  padding: 24,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

// ------------------------------------------------------------------ PlatformTenantManager

export function PlatformTenantManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, error: loadErr } = useQuery<TenantsResponse>({
    queryKey: ["platform/tenants"],
    queryFn: () => apiFetch<TenantsResponse>("/tenants?limit=200"),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform/tenants"] });
      setEditing(null);
    },
  });

  const toggleActive = useCallback(
    (t: Tenant) => {
      if (!window.confirm(`${t.isActive ? "Deactivate" : "Activate"} "${t.name}"?`)) return;
      updateMutation.mutate({ id: t.id, body: { isActive: !t.isActive } });
    },
    [updateMutation],
  );

  const tenants = (data?.data ?? []).filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()),
  );

  if (editing) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => setEditing(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.blue,
              fontSize: 14,
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: 20, color: C.gray900 }}>
            Edit: {editing.name}
          </h2>
        </div>
        <TenantEditForm
          tenant={editing}
          saving={updateMutation.isPending}
          error={updateMutation.error instanceof Error ? updateMutation.error.message : null}
          onSubmit={(body) => updateMutation.mutate({ id: editing.id, body })}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

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
            All Institutes
          </h2>
          <p style={{ margin: 0, color: C.gray500, fontSize: 14 }}>
            {data?.total ?? 0} institutes registered on the platform
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={{ ...inputCss, maxWidth: 320 }}
          placeholder="Search by name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadErr && (
        <div
          style={{
            background: C.redBg,
            color: C.redText,
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Failed to load tenants
        </div>
      )}

      {isLoading ? (
        <p style={{ color: C.gray400 }}>Loading…</p>
      ) : tenants.length === 0 ? (
        <p style={{ color: C.gray400, fontSize: 14 }}>No institutes found.</p>
      ) : (
        <div style={cardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                {["Name", "Slug", "Contact", "Status", "Setup", "Created", ""].map(
                  (h) => (
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
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="amis-row-hover" style={{ borderBottom: `1px solid ${C.gray100}` }}>
                  <td style={{ padding: "11px 12px", fontWeight: 600, color: C.gray900 }}>
                    {t.name}
                    {t.logoUrl && (
                      <img
                        src={t.logoUrl}
                        alt=""
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 3,
                          objectFit: "cover",
                          marginLeft: 8,
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                  </td>
                  <td
                    style={{
                      padding: "11px 12px",
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: C.gray500,
                    }}
                  >
                    {t.slug}
                  </td>
                  <td style={{ padding: "11px 12px", color: C.gray700, fontSize: 13 }}>
                    {t.contactEmail ?? <span style={{ color: C.gray300 }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: t.isActive ? C.greenBg : C.redBg,
                        color: t.isActive ? C.greenText : C.redText,
                      }}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: t.setupCompleted ? C.greenBg : C.yellowBg,
                        color: t.setupCompleted ? C.greenText : C.yellowText,
                      }}
                    >
                      {t.setupCompleted ? "✓ Done" : "Pending"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", color: C.gray500, fontSize: 12 }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setEditing(t)}
                        style={{
                          padding: "4px 12px",
                          background: C.gray100,
                          border: `1px solid ${C.gray300}`,
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          color: C.gray700,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(t)}
                        style={{
                          padding: "4px 12px",
                          background: t.isActive ? C.redBg : C.greenBg,
                          border: `1px solid ${t.isActive ? "#fca5a5" : "#86efac"}`,
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          color: t.isActive ? C.redText : C.greenText,
                          fontWeight: 600,
                        }}
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ TenantEditForm

interface EditBody {
  name?: string;
  contactEmail?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
}

function TenantEditForm({
  tenant,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  tenant: Tenant;
  saving: boolean;
  error: string | null;
  onSubmit: (body: EditBody) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: tenant.name,
    contactEmail: tenant.contactEmail ?? "",
    address: tenant.address ?? "",
    phone: tenant.phone ?? "",
    logoUrl: tenant.logoUrl ?? "",
    isActive: tenant.isActive,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: form.name || undefined,
      contactEmail: form.contactEmail || null,
      address: form.address || null,
      phone: form.phone || null,
      logoUrl: form.logoUrl || null,
      isActive: form.isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Institute Name *</label>
            <input
              style={inputCss}
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Contact Email</label>
            <input
              style={inputCss}
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm((p) => ({ ...p, contactEmail: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputCss}
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Address</label>
            <input
              style={inputCss}
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Logo URL</label>
            <input
              style={inputCss}
              type="url"
              value={form.logoUrl}
              placeholder="https://…"
              onChange={(e) =>
                setForm((p) => ({ ...p, logoUrl: e.target.value }))
              }
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.target.checked }))
              }
              style={{ width: 16, height: 16 }}
            />
            <label
              htmlFor="isActive"
              style={{ fontSize: 14, fontWeight: 500, color: C.gray700 }}
            >
              Active (VTI can log in)
            </label>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: C.redBg,
              color: C.redText,
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 24px",
              background: saving ? C.gray400 : C.blue,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 24px",
              background: C.gray100,
              border: `1px solid ${C.gray300}`,
              borderRadius: 8,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
