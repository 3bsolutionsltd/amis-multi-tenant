/**
 * UATFeedbackPage — public page for VTI testers to submit feedback
 * during the current User Acceptance Testing phase.
 * Route: /uat-feedback  (no auth required)
 */
import { useState } from "react";
import { apiFetch } from "../../lib/apiFetch";
import { ensureGlobalCss, C, inputCss } from "../../lib/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MODULES = [
  "Student Registration & Management",
  "Admissions & Applications",
  "Programmes & Courses",
  "Term Registrations",
  "Marks & Results",
  "Fee Management & Payments",
  "Timetabling",
  "Attendance",
  "Industrial Training & Field Placements",
  "Reports (IT Reports, NCHE, Class Lists)",
  "Staff Management",
  "User & Role Management",
  "Dashboard & Analytics",
  "Alumni Management",
  "Procurement & Inventory",
  "Clearance Module",
];

const ROLES = [
  "Principal / Director",
  "Registrar",
  "Finance Officer",
  "Dean of Studies",
  "Head of Department",
  "Instructor / Lecturer",
  "ICT Officer",
  "Other",
];

const SEVERITY_OPTIONS = [
  { value: "none", label: "No Issues — everything worked", color: C.green },
  { value: "minor", label: "Minor — small annoyances, workarounds exist", color: C.yellow },
  { value: "major", label: "Major — significant problems hindering work", color: "#f97316" },
  { value: "critical", label: "Critical — system unusable / data at risk", color: C.red },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  padding: "28px 32px",
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: C.gray400,
  marginBottom: 16,
  marginTop: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 5,
};

const textareaCss: React.CSSProperties = {
  ...inputCss,
  height: 100,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const fieldWrap: React.CSSProperties = { marginBottom: 18 };

// ---------------------------------------------------------------------------
// Star Rating component
// ---------------------------------------------------------------------------
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={labels[n]}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 28,
            padding: 2,
            color: n <= (hover || value) ? "#f59e0b" : C.gray300,
            transition: "color 0.1s",
          }}
        >
          ★
        </button>
      ))}
      {(hover || value) > 0 && (
        <span style={{ fontSize: 13, color: C.gray500, marginLeft: 4 }}>
          {labels[hover || value]}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function UATFeedbackPage() {
  ensureGlobalCss();

  const [form, setForm] = useState({
    vtiName: "",
    testerName: "",
    email: "",
    role: "",
    otherRole: "",
    testDate: new Date().toISOString().split("T")[0],
    modulesTestedOk: [] as string[],
    moduleIssues: [] as string[],
    overallRating: 0,
    easeOfUseRating: 0,
    performanceRating: 0,
    severity: "",
    issuesDescription: "",
    whatWorked: "",
    suggestions: "",
    wouldRecommend: "",
    additionalNotes: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleModule(module: string, list: "modulesTestedOk" | "moduleIssues") {
    set(list, (form[list] as string[]).includes(module)
      ? (form[list] as string[]).filter((m) => m !== module)
      : [...(form[list] as string[]), module]
    );
  }

  function validate(): string | null {
    if (!form.vtiName.trim()) return "Institute name is required";
    if (!form.testerName.trim()) return "Your name is required";
    if (!form.email.trim()) return "Email address is required";
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) return "Please enter a valid email";
    if (!form.role) return "Please select your role";
    if (form.overallRating === 0) return "Please provide an overall rating";
    if (!form.severity) return "Please select the severity of any issues encountered";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);

    try {
      const roleDisplay = form.role === "Other" ? form.otherRole || "Other" : form.role;

      await apiFetch<void>("/feedback", {
        method: "POST",
        body: JSON.stringify({ ...form, role: roleDisplay }),
      });

      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (submitted) {
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
        <div style={{ ...cardStyle, maxWidth: 520, textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🙏</div>
          <h2 style={{ color: C.gray900, margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
            Thank You for Your Feedback!
          </h2>
          <p style={{ color: C.gray500, fontSize: 14, margin: "0 0 20px" }}>
            Your feedback has been sent directly to the AMIS team at{" "}
            <strong>support@amis.institute</strong>. We appreciate your time!
          </p>
          <div
            style={{
              background: C.greenBg,
              border: `1px solid #86efac`,
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              color: C.greenText,
              marginBottom: 20,
            }}
          >
            Feedback submitted by <strong>{form.testerName}</strong> from{" "}
            <strong>{form.vtiName}</strong>
          </div>
          <button
            onClick={() => { setSubmitted(false); setForm((p) => ({ ...p, vtiName: "", testerName: "", email: "", issuesDescription: "", whatWorked: "", suggestions: "", additionalNotes: "", modulesTestedOk: [], moduleIssues: [], overallRating: 0, easeOfUseRating: 0, performanceRating: 0, severity: "", wouldRecommend: "" })); }}
            style={{
              background: C.blue,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        padding: "40px 16px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
              margin: "0 0 6px",
            }}
          >
            AMIS UAT Feedback Form
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            Help us improve the system — your feedback shapes the final release.
          </p>
          <div
            style={{
              display: "inline-block",
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.4)",
              color: "#fbbf24",
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 600,
              marginTop: 10,
            }}
          >
            Testing Phase · June 2026
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Error banner */}
          {error && (
            <div
              style={{
                background: C.redBg,
                color: C.redText,
                border: `1px solid #fca5a5`,
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* ── Section 1: Your Details ─────────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>1 — Your Details</p>

            <div style={fieldWrap}>
              <label style={labelStyle}>Institute Name *</label>
              <input
                style={inputCss}
                placeholder="e.g. Kasese Technical Institute"
                value={form.vtiName}
                onChange={(e) => set("vtiName", e.target.value)}
                required
              />
            </div>

            <div style={{ ...gridTwo, ...fieldWrap }}>
              <div>
                <label style={labelStyle}>Your Full Name *</label>
                <input
                  style={inputCss}
                  placeholder="Full name"
                  value={form.testerName}
                  onChange={(e) => set("testerName", e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input
                  style={inputCss}
                  type="email"
                  placeholder="you@institute.ac.ug"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ ...gridTwo, ...fieldWrap }}>
              <div>
                <label style={labelStyle}>Your Role *</label>
                <select
                  style={inputCss}
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  required
                >
                  <option value="">Select role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {form.role === "Other" && (
                <div>
                  <label style={labelStyle}>Please Specify Role *</label>
                  <input
                    style={inputCss}
                    placeholder="Your specific role"
                    value={form.otherRole}
                    onChange={(e) => set("otherRole", e.target.value)}
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>Date of Testing</label>
                <input
                  style={inputCss}
                  type="date"
                  value={form.testDate}
                  onChange={(e) => set("testDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Modules Tested ───────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>2 — Modules Tested</p>
            <p style={{ fontSize: 13, color: C.gray500, marginTop: 0, marginBottom: 16 }}>
              Select the modules you used during testing. Mark each as{" "}
              <span style={{ color: C.green, fontWeight: 600 }}>Working OK</span> or{" "}
              <span style={{ color: C.red, fontWeight: 600 }}>Had Issues</span>{" "}
              (you can tick both if partially working).
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 8,
              }}
            >
              {MODULES.map((mod) => {
                const isOk = form.modulesTestedOk.includes(mod);
                const hasIssue = form.moduleIssues.includes(mod);
                return (
                  <div
                    key={mod}
                    style={{
                      background: isOk
                        ? C.greenBg
                        : hasIssue
                        ? C.redBg
                        : C.gray50,
                      border: `1px solid ${
                        isOk ? "#86efac" : hasIssue ? "#fca5a5" : C.gray200
                      }`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: C.gray700,
                        marginBottom: 8,
                      }}
                    >
                      {mod}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          cursor: "pointer",
                          color: C.greenText,
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isOk}
                          onChange={() => toggleModule(mod, "modulesTestedOk")}
                          style={{ accentColor: C.green }}
                        />
                        ✓ Works OK
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          cursor: "pointer",
                          color: C.redText,
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={hasIssue}
                          onChange={() => toggleModule(mod, "moduleIssues")}
                          style={{ accentColor: C.red }}
                        />
                        ✗ Had Issues
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Section 3: Ratings ─────────────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>3 — Your Ratings</p>

            <div style={fieldWrap}>
              <label style={labelStyle}>Overall Experience *</label>
              <StarRating value={form.overallRating} onChange={(v) => set("overallRating", v)} />
            </div>

            <div style={{ ...gridTwo }}>
              <div style={fieldWrap}>
                <label style={labelStyle}>Ease of Use</label>
                <StarRating
                  value={form.easeOfUseRating}
                  onChange={(v) => set("easeOfUseRating", v)}
                />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>System Performance / Speed</label>
                <StarRating
                  value={form.performanceRating}
                  onChange={(v) => set("performanceRating", v)}
                />
              </div>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Overall Issue Severity *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SEVERITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${form.severity === opt.value ? opt.color : C.gray200}`,
                      background: form.severity === opt.value ? `${opt.color}15` : C.gray50,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={opt.value}
                      checked={form.severity === opt.value}
                      onChange={(e) => set("severity", e.target.value)}
                      style={{ accentColor: opt.color }}
                    />
                    <span style={{ fontWeight: 600, color: opt.color }}>
                      {opt.label.split("—")[0].trim()}
                    </span>
                    <span style={{ color: C.gray500, fontSize: 13 }}>
                      — {opt.label.split("—")[1]?.trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section 4: Written Feedback ────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>4 — Written Feedback</p>

            <div style={fieldWrap}>
              <label style={labelStyle}>Issues Encountered</label>
              <p style={{ fontSize: 12, color: C.gray500, margin: "0 0 6px" }}>
                Describe any bugs, errors, or problems you encountered. Include steps to reproduce if possible.
              </p>
              <textarea
                style={textareaCss}
                placeholder="e.g. When I click 'Save' on the marks entry page, I get an error 422. Steps: 1. Go to Marks > Bulk Entry, 2. Select course, 3. Enter marks, 4. Click Save..."
                value={form.issuesDescription}
                onChange={(e) => set("issuesDescription", e.target.value)}
              />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>What Worked Well</label>
              <textarea
                style={textareaCss}
                placeholder="e.g. The student import feature was fast and easy to use. The fee receipt printing looked professional..."
                value={form.whatWorked}
                onChange={(e) => set("whatWorked", e.target.value)}
              />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Suggestions & Improvements</label>
              <textarea
                style={textareaCss}
                placeholder="e.g. It would help to have a bulk SMS notification feature after fee payment. The dashboard could show overdue fees at a glance..."
                value={form.suggestions}
                onChange={(e) => set("suggestions", e.target.value)}
              />
            </div>
          </div>

          {/* ── Section 5: Final Questions ─────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>5 — Final Questions</p>

            <div style={fieldWrap}>
              <label style={labelStyle}>
                Would you recommend AMIS to other VTIs?
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                {["Definitely yes", "Probably yes", "Not sure", "Probably not", "Definitely not"].map(
                  (opt) => (
                    <label
                      key={opt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${form.wouldRecommend === opt ? C.blue : C.gray200}`,
                        background: form.wouldRecommend === opt ? C.blueBg : C.gray50,
                        color: form.wouldRecommend === opt ? C.blueText : C.gray700,
                        fontWeight: form.wouldRecommend === opt ? 600 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="wouldRecommend"
                        value={opt}
                        checked={form.wouldRecommend === opt}
                        onChange={(e) => set("wouldRecommend", e.target.value)}
                        style={{ accentColor: C.blue }}
                      />
                      {opt}
                    </label>
                  )
                )}
              </div>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Any Other Notes or Comments</label>
              <textarea
                style={textareaCss}
                placeholder="Anything else you'd like the AMIS team to know..."
                value={form.additionalNotes}
                onChange={(e) => set("additionalNotes", e.target.value)}
              />
            </div>
          </div>

          {/* ── Submit ─────────────────────────────────────────────────── */}
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "20px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px" }}>
              Your feedback will be sent directly to{" "}
              <strong style={{ color: "#cbd5e1" }}>support@amis.institute</strong>.
            </p>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? C.gray400 : C.blue,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "13px 40px",
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {submitting ? "Preparing…" : "Submit Feedback →"}
            </button>
          </div>
        </form>

        <p style={{ textAlign: "center", color: "#475569", fontSize: 12, marginTop: 24 }}>
          AMIS — Academic Management Information System &nbsp;·&nbsp; Testing Phase June 2026
        </p>
      </div>
    </div>
  );
}
