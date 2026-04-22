import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { C, inputCss } from "../lib/ui";

interface ProvisionResult {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  adminEmail: string;
  temporaryPassword?: string;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.gray400,
  marginTop: 4,
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export function ProvisionVtiPage() {
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [form, setForm] = useState({
    instituteName: "",
    slug: "",
    contactEmail: "",
    phone: "",
    address: "",
    adminEmail: "",
    adminPassword: "",
  });

  const provision = useMutation({
    mutationFn: (body: object) =>
      apiFetch<ProvisionResult>("/onboarding/provision", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  function handleNameChange(value: string) {
    setForm((p) => ({
      ...p,
      instituteName: value,
      slug: p.slug || slugify(value),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    provision.mutate({
      instituteName: form.instituteName,
      slug: form.slug,
      contactEmail: form.contactEmail,
      phone: form.phone || undefined,
      address: form.address || undefined,
      adminEmail: form.adminEmail,
      adminPassword: form.adminPassword || undefined,
    });
  }

  if (result) {
    return (
      <div style={{ maxWidth: 540 }}>
        <div
          style={{
            background: C.greenBg,
            border: `1px solid #86efac`,
            borderRadius: 12,
            padding: 28,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h2 style={{ margin: "0 0 8px", color: C.greenText, fontSize: 20 }}>
            VTI Provisioned Successfully
          </h2>
          <p style={{ margin: "0 0 16px", color: C.greenText, fontSize: 14 }}>
            The institute has been created and the admin account is ready.
          </p>
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <Row label="Institute" value={result.tenant.name} />
            <Row label="Slug" value={result.tenant.slug} mono />
            <Row label="Admin Email" value={result.adminEmail} />
            {result.temporaryPassword && (
              <Row
                label="Temporary Password"
                value={result.temporaryPassword}
                sensitive
              />
            )}
          </div>
        </div>

        {result.temporaryPassword && (
          <div
            style={{
              background: C.yellowBg,
              border: `1px solid #fde68a`,
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              color: C.yellowText,
              marginBottom: 20,
            }}
          >
            ⚠️ Copy and share the temporary password with the VTI admin now — it won't be shown again.
          </div>
        )}

        <button
          onClick={() => {
            setResult(null);
            setForm({
              instituteName: "",
              slug: "",
              contactEmail: "",
              phone: "",
              address: "",
              adminEmail: "",
              adminPassword: "",
            });
          }}
          style={{
            padding: "10px 24px",
            background: C.purple,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Provision Another VTI
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 22, color: C.gray900 }}>
        Provision New VTI
      </h2>
      <p style={{ color: C.gray500, marginBottom: 28, fontSize: 14 }}>
        Manually create an institute account on behalf of a VTI. An admin user
        will be created and can log in immediately.
      </p>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: "#fff",
            border: `1px solid ${C.gray200}`,
            borderRadius: 12,
            padding: 28,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: C.gray700, fontWeight: 700 }}>
            Institute Details
          </h3>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Institute Name *</label>
            <input
              style={inputCss}
              required
              placeholder="e.g. Nile Technical Institute"
              value={form.instituteName}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>URL Slug *</label>
            <input
              style={inputCss}
              required
              placeholder="nile-technical-institute"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              title="Lowercase letters, numbers, hyphens only"
              value={form.slug}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                }))
              }
            />
            <div style={helpStyle}>Cannot be changed later.</div>
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
              <label style={labelStyle}>Contact Email *</label>
              <input
                style={inputCss}
                type="email"
                required
                placeholder="info@institute.ac.ug"
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
                placeholder="+256 …"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
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
                setForm((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: `1px solid ${C.gray200}`,
            borderRadius: 12,
            padding: 28,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: C.gray700, fontWeight: 700 }}>
            Initial Admin Account
          </h3>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Admin Email *</label>
            <input
              style={inputCss}
              type="email"
              required
              placeholder="admin@institute.ac.ug"
              value={form.adminEmail}
              onChange={(e) =>
                setForm((p) => ({ ...p, adminEmail: e.target.value }))
              }
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              style={inputCss}
              type="password"
              placeholder="Leave blank to auto-generate"
              value={form.adminPassword}
              onChange={(e) =>
                setForm((p) => ({ ...p, adminPassword: e.target.value }))
              }
            />
            <div style={helpStyle}>
              If left blank, a secure temporary password will be generated for you to share.
            </div>
          </div>
        </div>

        {provision.error && (
          <div
            style={{
              background: C.redBg,
              color: C.redText,
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {provision.error instanceof Error
              ? provision.error.message
              : "Failed to provision VTI"}
          </div>
        )}

        <button
          type="submit"
          disabled={provision.isPending}
          style={{
            padding: "12px 32px",
            background: provision.isPending ? C.gray400 : C.purple,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: provision.isPending ? "not-allowed" : "pointer",
            width: "100%",
          }}
        >
          {provision.isPending ? "Provisioning…" : "Provision Institute"}
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ helpers

function Row({
  label,
  value,
  mono,
  sensitive,
}: {
  label: string;
  value: string;
  mono?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: C.gray500 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: sensitive ? C.redText : C.gray900,
          fontFamily: mono || sensitive ? "monospace" : undefined,
          background: sensitive ? C.redBg : undefined,
          padding: sensitive ? "2px 8px" : undefined,
          borderRadius: sensitive ? 4 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
