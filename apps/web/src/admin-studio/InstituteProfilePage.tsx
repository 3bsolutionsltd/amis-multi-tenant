import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { C, inputCss } from "../lib/ui";

interface TenantProfile {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  contactEmail: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  setupCompleted: boolean;
  setupCompletedAt: string | null;
  createdAt: string;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.gray200}`,
  borderRadius: 12,
  padding: 28,
  marginBottom: 24,
};

export function InstituteProfilePage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    contactEmail: string;
    phone: string;
    address: string;
    logoUrl: string;
  } | null>(null);

  const { data: profile, isLoading } = useQuery<TenantProfile>({
    queryKey: ["tenants/me"],
    queryFn: () => apiFetch<TenantProfile>("/tenants/me"),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (profile && !form) {
      setForm({
        name: profile.name,
        contactEmail: profile.contactEmail ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        logoUrl: profile.logoUrl ?? "",
      });
    }
  }, [profile, form]);

  const updateMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/tenants/me", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants/me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiFetch("/tenants/me", {
        method: "PUT",
        body: JSON.stringify({ setupCompleted: true }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants/me"] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate({
      name: form.name,
      contactEmail: form.contactEmail || null,
      phone: form.phone || null,
      address: form.address || null,
      logoUrl: form.logoUrl || null,
    });
  }

  if (isLoading || !profile || !form) {
    return <p style={{ color: C.gray400 }}>Loading institute profile…</p>;
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, color: C.gray900 }}>
          Institute Profile
        </h2>
        <p style={{ margin: 0, color: C.gray500, fontSize: 14 }}>
          Manage your institute's details and identity.
        </p>
      </div>

      {/* Setup completion banner */}
      {!profile.setupCompleted && (
        <div
          style={{
            background: C.yellowBg,
            border: `1px solid #fde68a`,
            borderRadius: 10,
            padding: "16px 20px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: C.yellowText, marginBottom: 2 }}>
              ⚠️ Setup Incomplete
            </div>
            <div style={{ fontSize: 13, color: C.yellowText }}>
              Complete your institute profile and mark setup as done to unlock all features.
            </div>
          </div>
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            style={{
              padding: "9px 18px",
              background: C.green,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: completeMutation.isPending ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {completeMutation.isPending ? "Saving…" : "Mark as Complete ✓"}
          </button>
        </div>
      )}

      {profile.setupCompleted && (
        <div
          style={{
            background: C.greenBg,
            border: `1px solid #86efac`,
            borderRadius: 10,
            padding: "12px 20px",
            marginBottom: 24,
            fontSize: 14,
            color: C.greenText,
            fontWeight: 500,
          }}
        >
          ✅ Setup complete
          {profile.setupCompletedAt &&
            ` · ${new Date(profile.setupCompletedAt).toLocaleDateString()}`}
        </div>
      )}

      {/* Meta info */}
      <div
        style={{
          ...cardStyle,
          background: C.gray50,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <MetaField label="Tenant ID" value={profile.id.slice(0, 8) + "…"} mono />
        <MetaField label="Slug" value={profile.slug} mono />
        <MetaField
          label="Status"
          value={profile.isActive ? "Active" : "Inactive"}
          color={profile.isActive ? C.greenText : C.redText}
        />
      </div>

      {/* Editable form */}
      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: C.gray700, fontWeight: 700 }}>
            Institute Details
          </h3>

          {/* Logo preview */}
          {form.logoUrl && (
            <div style={{ marginBottom: 18 }}>
              <img
                src={form.logoUrl}
                alt="Logo"
                style={{
                  height: 60,
                  borderRadius: 8,
                  objectFit: "contain",
                  border: `1px solid ${C.gray200}`,
                  padding: 4,
                  background: "#fff",
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Institute Name *</label>
            <input
              style={inputCss}
              required
              value={form.name}
              onChange={(e) => setForm((p) => p && { ...p, name: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Logo URL</label>
            <input
              style={inputCss}
              type="url"
              placeholder="https://your-institute.com/logo.png"
              value={form.logoUrl}
              onChange={(e) =>
                setForm((p) => p && { ...p, logoUrl: e.target.value })
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input
                style={inputCss}
                type="email"
                placeholder="info@institute.ac.ug"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((p) => p && { ...p, contactEmail: e.target.value })
                }
              />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input
                style={inputCss}
                placeholder="+256 700 000 000"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => p && { ...p, phone: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Address / Location</label>
            <input
              style={inputCss}
              placeholder="Kampala, Uganda"
              value={form.address}
              onChange={(e) =>
                setForm((p) => p && { ...p, address: e.target.value })
              }
            />
          </div>
        </div>

        {updateMutation.error && (
          <div
            style={{
              background: C.redBg,
              color: C.redText,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : "Failed to save"}
          </div>
        )}

        {saved && (
          <div
            style={{
              background: C.greenBg,
              color: C.greenText,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            ✓ Profile saved successfully
          </div>
        )}

        <button
          type="submit"
          disabled={updateMutation.isPending}
          style={{
            padding: "11px 32px",
            background: updateMutation.isPending ? C.gray400 : C.blue,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: updateMutation.isPending ? "not-allowed" : "pointer",
          }}
        >
          {updateMutation.isPending ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: color ?? C.gray700,
          fontFamily: mono ? "monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
