import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { C, inputCss, selectCss } from "../lib/ui";
import { setTokens } from "../lib/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Step = 1 | 2 | 3 | 4;

interface InstituteForm {
  instituteName: string;
  slug: string;
  contactEmail: string;
  phone: string;
  address: string;
}

interface AdminForm {
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

interface TvetForm {
  ownershipType: string;
  uvtabCentreCode: string;
  licenseNumber: string;
  licenseStatus: string;
  licenseDate: string;
}

// ------------------------------------------------------------------ helpers

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

// ------------------------------------------------------------------ styles

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
  padding: "40px 48px",
  maxWidth: 560,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.gray500,
  marginTop: 4,
};

const btnPrimary: React.CSSProperties = {
  background: C.blue,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 28px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: C.gray700,
  border: `1px solid ${C.gray300}`,
  borderRadius: 8,
  padding: "11px 28px",
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
};

const STEPS = ["Institute Info", "TVET Compliance", "Admin Account", "Review & Launch"];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  background: done ? C.green : active ? C.blue : C.gray200,
                  color: done || active ? "#fff" : C.gray500,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : num}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: active ? C.blue : done ? C.green : C.gray400,
                  marginTop: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? C.green : C.gray200,
                  margin: "0 8px",
                  marginBottom: 18,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Main

export function VtiSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [institute, setInstitute] = useState<InstituteForm>({
    instituteName: "",
    slug: "",
    contactEmail: "",
    phone: "",
    address: "",
  });

  const [tvet, setTvet] = useState<TvetForm>({
    ownershipType: "",
    uvtabCentreCode: "",
    licenseNumber: "",
    licenseStatus: "active",
    licenseDate: "",
  });

  const [admin, setAdmin] = useState<AdminForm>({
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
  });

  // -- Step 1: Institute Info
  function handleInstituteChange(field: keyof InstituteForm, value: string) {
    setInstitute((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from name
      if (field === "instituteName" && !prev.slug) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function validateStep1(): string | null {
    if (!institute.instituteName.trim()) return "Institute name is required";
    if (!institute.slug.trim()) return "URL slug is required";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(institute.slug))
      return "Slug must be lowercase letters, numbers, and hyphens only";
    if (!institute.contactEmail.trim()) return "Contact email is required";
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(institute.contactEmail))
      return "Please enter a valid email address";
    return null;
  }

  function validateStep2(): string | null {
    if (!tvet.ownershipType) return "Ownership type is required for TVET Act compliance";
    return null;
  }

  function validateStep3(): string | null {
    if (!admin.adminEmail.trim()) return "Admin email is required";
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(admin.adminEmail))
      return "Please enter a valid admin email address";
    if (!admin.adminPassword) return "Password is required";
    if (admin.adminPassword.length < 8) return "Password must be at least 8 characters";
    if (admin.adminPassword !== admin.confirmPassword) return "Passwords do not match";
    return null;
  }

  function handleStep1Submit(e: FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError(null);
    setStep(2);
  }

  function handleStep2Submit(e: FormEvent) {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError(null);
    setStep(3);
  }

  function handleStep3Submit(e: FormEvent) {
    e.preventDefault();
    const err = validateStep3();
    if (err) { setError(err); return; }
    setError(null);
    setStep(4);
  }

  async function handleLaunch() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteName: institute.instituteName,
          slug: institute.slug,
          contactEmail: institute.contactEmail,
          phone: institute.phone || undefined,
          address: institute.address || undefined,
          ownershipType: tvet.ownershipType,
          uvtabCentreCode: tvet.uvtabCentreCode || undefined,
          licenseNumber: tvet.licenseNumber || undefined,
          licenseDate: tvet.licenseDate || undefined,
          licenseStatus: tvet.licenseStatus || "active",
          adminEmail: admin.adminEmail,
          adminPassword: admin.adminPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { message?: string }).message ?? `Error ${res.status}`,
        );
      }

      const data = await res.json() as {
        accessToken: string;
        refreshToken: string;
        userId: string;
        tenantId: string;
        tenantSlug: string;
        adminEmail: string;
      };

      // Store tokens and redirect into the app
      setTokens(data.accessToken, data.refreshToken, {
        id: data.userId,
        email: data.adminEmail,
        role: "admin",
        tenantId: data.tenantId,
      });
      setSuccess(true);

      setTimeout(() => {
        navigate("/admin-studio");
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ color: C.gray900, marginTop: 0, marginBottom: 8 }}>
            Your institute is ready!
          </h2>
          <p style={{ color: C.gray500, marginBottom: 0 }}>
            Taking you to Admin Studio to complete your setup…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: C.gray900,
              margin: "0 0 6px",
            }}
          >
            Register Your Institute
          </h1>
          <p style={{ color: C.gray500, margin: 0, fontSize: 14 }}>
            Set up your AMIS account — it only takes a few minutes.
          </p>
        </div>

        <StepIndicator current={step} />

        {error && (
          <div
            style={{
              background: C.redBg,
              color: C.redText,
              border: `1px solid #fca5a5`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Institute Name *</label>
              <input
                style={inputCss}
                placeholder="e.g. Greenfield Vocational Training Institute"
                value={institute.instituteName}
                onChange={(e) =>
                  handleInstituteChange("instituteName", e.target.value)
                }
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>URL Slug *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <span
                  style={{
                    padding: "9px 12px",
                    background: C.gray100,
                    border: `1px solid ${C.gray300}`,
                    borderRight: "none",
                    borderRadius: "6px 0 0 6px",
                    fontSize: 13,
                    color: C.gray500,
                    whiteSpace: "nowrap",
                  }}
                >
                  amis.institute/
                </span>
                <input
                  style={{
                    ...inputCss,
                    borderRadius: "0 6px 6px 0",
                    borderLeft: "none",
                  }}
                  placeholder="greenfield-vti"
                  value={institute.slug}
                  onChange={(e) =>
                    handleInstituteChange(
                      "slug",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  required
                />
              </div>
              <div style={helpStyle}>
                Lowercase letters, numbers, and hyphens only. This cannot be changed later.
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Contact Email *</label>
              <input
                style={inputCss}
                type="email"
                placeholder="admin@institute.ac.ug"
                value={institute.contactEmail}
                onChange={(e) =>
                  handleInstituteChange("contactEmail", e.target.value)
                }
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  style={inputCss}
                  placeholder="+256 700 000 000"
                  value={institute.phone}
                  onChange={(e) => handleInstituteChange("phone", e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Location / Address</label>
                <input
                  style={inputCss}
                  placeholder="Kampala, Uganda"
                  value={institute.address}
                  onChange={(e) =>
                    handleInstituteChange("address", e.target.value)
                  }
                />
              </div>
            </div>

            <button type="submit" style={btnPrimary}>
              Continue →
            </button>

            <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.gray500 }}>
              Already set up?{" "}
              <a href="/login" style={{ color: C.blue, textDecoration: "none" }}>
                Sign in
              </a>
            </p>
          </form>
        )}

        {/* Step 2: TVET Compliance */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Ownership Type *</label>
              <select
                style={selectCss}
                value={tvet.ownershipType}
                onChange={(e) => setTvet((p) => ({ ...p, ownershipType: e.target.value }))}
                required
              >
                <option value="">Select ownership type…</option>
                <option value="public">Government / Public</option>
                <option value="private">Private</option>
                <option value="faith_based">Faith-Based</option>
                <option value="community">Community</option>
              </select>
              <div style={helpStyle}>Required by TVET Act — determines regulatory pathway.</div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>UVTAB Centre Code</label>
              <input
                style={inputCss}
                placeholder="e.g. UVT212"
                value={tvet.uvtabCentreCode}
                onChange={(e) => setTvet((p) => ({ ...p, uvtabCentreCode: e.target.value.toUpperCase() }))}
              />
              <div style={helpStyle}>
                Uganda Vocational Qualifications Framework exam centre code. Used for UVTAB
                examination entry lists. Leave blank if not yet assigned.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>TVET License Number</label>
                <input
                  style={inputCss}
                  placeholder="e.g. TVETA/LIC/2024/001"
                  value={tvet.licenseNumber}
                  onChange={(e) => setTvet((p) => ({ ...p, licenseNumber: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>License Issue Date</label>
                <input
                  style={inputCss}
                  type="date"
                  value={tvet.licenseDate}
                  onChange={(e) => setTvet((p) => ({ ...p, licenseDate: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>License Status</label>
              <select
                style={selectCss}
                value={tvet.licenseStatus}
                onChange={(e) => setTvet((p) => ({ ...p, licenseStatus: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="pending">Pending (application in progress)</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => { setError(null); setStep(1); }}
              >
                ← Back
              </button>
              <button type="submit" style={btnPrimary}>
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Admin Account */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit}>
            <p style={{ fontSize: 14, color: C.gray500, marginTop: 0, marginBottom: 20 }}>
              Create the initial administrator account for your institute.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Admin Email *</label>
              <input
                style={inputCss}
                type="email"
                placeholder="admin@institute.ac.ug"
                value={admin.adminEmail}
                onChange={(e) =>
                  setAdmin((p) => ({ ...p, adminEmail: e.target.value }))
                }
                required
              />
              <div style={helpStyle}>
                This will be the primary admin login for your institute.
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Password *</label>
              <input
                style={inputCss}
                type="password"
                placeholder="Minimum 8 characters"
                value={admin.adminPassword}
                onChange={(e) =>
                  setAdmin((p) => ({ ...p, adminPassword: e.target.value }))
                }
                required
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm Password *</label>
              <input
                style={inputCss}
                type="password"
                placeholder="Re-enter your password"
                value={admin.confirmPassword}
                onChange={(e) =>
                  setAdmin((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => { setError(null); setStep(2); }}
              >
                ← Back
              </button>
              <button type="submit" style={btnPrimary}>
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: 14, color: C.gray500, marginTop: 0, marginBottom: 20 }}>
              Review your details before launching.
            </p>

            <div
              style={{
                background: C.gray50,
                border: `1px solid ${C.gray200}`,
                borderRadius: 10,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Institute Details
                </div>
                {[
                  ["Name", institute.instituteName],
                  ["Slug", institute.slug],
                  ["Contact Email", institute.contactEmail],
                  institute.phone ? ["Phone", institute.phone] : null,
                  institute.address ? ["Address", institute.address] : null,
                ]
                  .filter(Boolean)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                      <span style={{ color: C.gray500 }}>{k}</span>
                      <span style={{ color: C.gray900, fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
              </div>

              <div style={{ borderTop: `1px solid ${C.gray200}`, paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  TVET Compliance
                </div>
                {[
                  ["Ownership", ({
                    public: "Government / Public",
                    private: "Private",
                    faith_based: "Faith-Based",
                    community: "Community",
                  } as Record<string, string>)[tvet.ownershipType] ?? tvet.ownershipType],
                  tvet.uvtabCentreCode ? ["UVTAB Code", tvet.uvtabCentreCode] : null,
                  tvet.licenseNumber ? ["License No.", tvet.licenseNumber] : null,
                  tvet.licenseDate ? ["License Date", tvet.licenseDate] : null,
                  ["License Status", tvet.licenseStatus],
                ]
                  .filter(Boolean)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                      <span style={{ color: C.gray500 }}>{k}</span>
                      <span style={{ color: C.gray900, fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
              </div>

              <div style={{ borderTop: `1px solid ${C.gray200}`, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Admin Account
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: C.gray500 }}>Email</span>
                  <span style={{ color: C.gray900, fontWeight: 500 }}>{admin.adminEmail}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => { setError(null); setStep(3); }}
                disabled={submitting}
              >
                ← Back
              </button>
              <button
                type="button"
                style={{ ...btnPrimary, background: C.green, opacity: submitting ? 0.7 : 1 }}
                onClick={handleLaunch}
                disabled={submitting}
              >
                {submitting ? "Launching…" : "🚀 Launch Institute"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
