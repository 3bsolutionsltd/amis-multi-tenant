import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { submitPublicApplication, type PublicApplyBody } from "./public.api";
import { ensureGlobalCss, inputCss } from "../../lib/ui";

const labelCss: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

const fieldWrap: React.CSSProperties = { marginBottom: 16 };

export function PublicApplicationPage() {
  ensureGlobalCss();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const [form, setForm] = useState<PublicApplyBody>({
    first_name: "",
    last_name: "",
    programme: "",
    intake: "",
    email: "",
    phone: "",
  });

  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => submitPublicApplication(tenantSlug!, form),
    onSuccess: (data) => setSubmittedId(data.application.id),
  });

  function set(field: keyof PublicApplyBody, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (submittedId) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "60px auto",
          padding: 32,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>
          Application Submitted
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Your application reference:
        </p>
        <code
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#f3f4f6",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          {submittedId}
        </code>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 16 }}>
          Save this reference to check your application status.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "60px auto",
        padding: 32,
        background: "white",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>Apply for Admission</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Fill in your details below to submit your application.
      </p>

      {mutation.error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            color: "#dc2626",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Failed to submit application. Please try again.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={fieldWrap}>
            <label style={labelCss}>First Name *</label>
            <input
              style={inputCss}
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              required
            />
          </div>
          <div style={fieldWrap}>
            <label style={labelCss}>Last Name *</label>
            <input
              style={inputCss}
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              required
            />
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={labelCss}>Programme *</label>
          <input
            style={inputCss}
            value={form.programme}
            onChange={(e) => set("programme", e.target.value)}
            required
            placeholder="e.g. Nursing, Electrical Engineering"
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelCss}>Intake *</label>
          <input
            style={inputCss}
            value={form.intake}
            onChange={(e) => set("intake", e.target.value)}
            required
            placeholder="e.g. 2026-Sept"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={fieldWrap}>
            <label style={labelCss}>Email</label>
            <input
              style={inputCss}
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div style={fieldWrap}>
            <label style={labelCss}>Phone</label>
            <input
              style={inputCss}
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          style={{
            width: "100%",
            padding: "10px 20px",
            background: mutation.isPending ? "#9ca3af" : "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
            marginTop: 8,
          }}
        >
          {mutation.isPending ? "Submitting…" : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
