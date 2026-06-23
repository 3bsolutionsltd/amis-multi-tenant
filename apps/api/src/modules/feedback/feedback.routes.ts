/**
 * Public UAT feedback endpoint — no auth required.
 * POST /feedback  →  sends feedback email to support@amis.institute
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendMail } from "../../lib/email.js";

const SUPPORT_EMAIL = process.env.UAT_FEEDBACK_EMAIL ?? "support@amis.institute";

// Known challenge Q&A pairs — must stay in sync with the frontend CHALLENGES array
const CHALLENGE_ANSWERS: Record<string, string> = {
  "What is 3 + 5?":  "8",
  "What is 6 + 2?":  "8",
  "What is 4 + 7?":  "11",
  "What is 9 - 3?":  "6",
  "What is 2 × 4?":  "8",
  "What is 10 - 4?": "6",
  "What is 5 + 6?":  "11",
  "What is 7 - 2?":  "5",
};

const FeedbackSchema = z.object({
  vtiName:            z.string().min(1).max(200),
  testerName:         z.string().min(1).max(200),
  email:              z.string().email().max(200),
  role:               z.string().min(1).max(100),
  testDate:           z.string().optional(),
  modulesTestedOk:    z.array(z.string()).default([]),
  moduleIssues:       z.array(z.string()).default([]),
  overallRating:      z.number().int().min(1).max(5),
  easeOfUseRating:    z.number().int().min(0).max(5).default(0),
  performanceRating:  z.number().int().min(0).max(5).default(0),
  severity:           z.enum(["none", "minor", "major", "critical"]),
  issuesDescription:  z.string().max(5000).default(""),
  whatWorked:         z.string().max(5000).default(""),
  suggestions:        z.string().max(5000).default(""),
  wouldRecommend:     z.string().max(100).default(""),
  additionalNotes:    z.string().max(5000).default(""),
  // Bot protection
  _hp:                z.string().default(""),          // honeypot — must be empty
  challengeQuestion:  z.string().max(200).default(""),
  challengeAnswer:    z.string().max(20).default(""),
});

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function buildFeedbackHtml(data: z.infer<typeof FeedbackSchema>): string {
  const severityColor: Record<string, string> = {
    none: "#16a34a",
    minor: "#d97706",
    major: "#f97316",
    critical: "#dc2626",
  };
  const color = severityColor[data.severity] ?? "#374151";

  const moduleRows = (mods: string[], ok: boolean) =>
    mods.length === 0
      ? `<tr><td colspan="2" style="padding:6px 12px;color:#9ca3af;font-style:italic;">${ok ? "None specified" : "None"}</td></tr>`
      : mods
          .map(
            (m) =>
              `<tr><td style="padding:5px 12px;color:#374151;">${ok ? "✓" : "✗"}</td><td style="padding:5px 12px;color:#374151;">${m}</td></tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:0">
<div style="max-width:640px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:#1e3a5f;padding:20px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">AMIS — UAT Feedback</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Testing Phase · June 2026</p>
  </div>

  <!-- Tester details -->
  <div style="padding:24px 32px 0">
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Tester Details</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:5px 0;color:#6b7280;width:140px">Institute</td><td style="padding:5px 0;color:#111827;font-weight:600">${data.vtiName}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">Name</td><td style="padding:5px 0;color:#111827">${data.testerName}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">Email</td><td style="padding:5px 0;color:#111827">${data.email}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">Role</td><td style="padding:5px 0;color:#111827">${data.role}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">Date</td><td style="padding:5px 0;color:#111827">${data.testDate ?? "—"}</td></tr>
    </table>
  </div>

  <!-- Modules -->
  <div style="padding:24px 32px 0">
    <h2 style="color:#1e293b;margin:0 0 12px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Modules Tested</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#dcfce7"><th colspan="2" style="padding:6px 12px;text-align:left;color:#15803d;font-size:13px">✓ Working OK</th></tr>
      ${moduleRows(data.modulesTestedOk, true)}
      <tr style="background:#fee2e2"><th colspan="2" style="padding:6px 12px;text-align:left;color:#b91c1c;font-size:13px">✗ Had Issues</th></tr>
      ${moduleRows(data.moduleIssues, false)}
    </table>
  </div>

  <!-- Ratings -->
  <div style="padding:24px 32px 0">
    <h2 style="color:#1e293b;margin:0 0 12px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Ratings</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:5px 0;color:#6b7280;width:200px">Overall Experience</td><td style="padding:5px 0;color:#f59e0b;letter-spacing:2px">${stars(data.overallRating)} <span style="color:#6b7280;font-size:13px">(${data.overallRating}/5)</span></td></tr>
      ${data.easeOfUseRating > 0 ? `<tr><td style="padding:5px 0;color:#6b7280">Ease of Use</td><td style="padding:5px 0;color:#f59e0b;letter-spacing:2px">${stars(data.easeOfUseRating)} <span style="color:#6b7280;font-size:13px">(${data.easeOfUseRating}/5)</span></td></tr>` : ""}
      ${data.performanceRating > 0 ? `<tr><td style="padding:5px 0;color:#6b7280">Performance</td><td style="padding:5px 0;color:#f59e0b;letter-spacing:2px">${stars(data.performanceRating)} <span style="color:#6b7280;font-size:13px">(${data.performanceRating}/5)</span></td></tr>` : ""}
    </table>
    <div style="margin-top:12px;display:inline-block;background:${color}18;border:1px solid ${color};border-radius:6px;padding:6px 14px;color:${color};font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">
      ${data.severity} severity
    </div>
  </div>

  <!-- Written feedback -->
  ${[
    ["Issues Encountered", data.issuesDescription],
    ["What Worked Well", data.whatWorked],
    ["Suggestions & Improvements", data.suggestions],
  ]
    .filter(([, v]) => v)
    .map(
      ([label, value]) => `
  <div style="padding:24px 32px 0">
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">${label}</h2>
    <p style="color:#374151;line-height:1.6;white-space:pre-wrap;margin:0">${value}</p>
  </div>`,
    )
    .join("")}

  <!-- Final questions -->
  <div style="padding:24px 32px">
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Final Questions</h2>
    ${data.wouldRecommend ? `<p style="margin:0 0 8px;color:#374151"><strong>Would recommend:</strong> ${data.wouldRecommend}</p>` : ""}
    ${data.additionalNotes ? `<p style="margin:0;color:#374151"><strong>Additional notes:</strong> ${data.additionalNotes}</p>` : ""}
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#94a3b8">
    AMIS — Academic Management Information System · Submitted via pre.amis.institute/uat-feedback
  </div>
</div>
</body>
</html>`;
}

function buildFeedbackText(data: z.infer<typeof FeedbackSchema>): string {
  return [
    `UAT FEEDBACK — ${data.vtiName}`,
    `=`.repeat(50),
    ``,
    `Tester:   ${data.testerName} <${data.email}>`,
    `Role:     ${data.role}`,
    `Date:     ${data.testDate ?? "—"}`,
    ``,
    `MODULES — Working OK`,
    data.modulesTestedOk.length ? data.modulesTestedOk.map((m) => `  ✓ ${m}`).join("\n") : "  (none)",
    ``,
    `MODULES — Had Issues`,
    data.moduleIssues.length ? data.moduleIssues.map((m) => `  ✗ ${m}`).join("\n") : "  (none)",
    ``,
    `RATINGS`,
    `  Overall:     ${data.overallRating}/5`,
    data.easeOfUseRating ? `  Ease of use: ${data.easeOfUseRating}/5` : null,
    data.performanceRating ? `  Performance: ${data.performanceRating}/5` : null,
    `  Severity:    ${data.severity.toUpperCase()}`,
    ``,
    `ISSUES ENCOUNTERED`,
    data.issuesDescription || "(none provided)",
    ``,
    `WHAT WORKED WELL`,
    data.whatWorked || "(none provided)",
    ``,
    `SUGGESTIONS`,
    data.suggestions || "(none provided)",
    ``,
    `Would recommend: ${data.wouldRecommend || "—"}`,
    data.additionalNotes ? `\nAdditional notes: ${data.additionalNotes}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export async function feedbackRoutes(app: FastifyInstance) {
  /**
   * POST /feedback
   * Public — no auth required.
   * Accepts UAT feedback and emails it to support@amis.institute.
   */
  app.post(
    "/feedback",
    {
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      const parsed = FeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      const data = parsed.data;

      // ── Bot protection ─────────────────────────────────────────────────
      // 1. Honeypot: reject silently if filled (bots fill hidden fields)
      if (data._hp.trim() !== "") {
        return reply.status(200).send({ ok: true }); // silent accept to confuse bots
      }

      // 2. Math challenge: validate answer against known Q&A lookup
      const expectedAnswer = CHALLENGE_ANSWERS[data.challengeQuestion];
      if (!expectedAnswer || data.challengeAnswer.trim() !== expectedAnswer) {
        return reply.status(422).send({ message: "Incorrect answer to the security question" });
      }
      // ──────────────────────────────────────────────────────────────────
      const subject = `AMIS UAT Feedback — ${data.vtiName} (${data.role}) · ${data.severity.toUpperCase()}`;

      // Send full copy to support inbox
      await sendMail({
        to: SUPPORT_EMAIL,
        subject,
        html: buildFeedbackHtml(data),
        text: buildFeedbackText(data),
      });

      // Send confirmation receipt to the submitter
      const confirmHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:0">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#1e3a5f;padding:20px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">AMIS — Feedback Received</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Testing Phase · June 2026</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#374151;margin:0 0 16px">Hello <strong>${data.testerName}</strong>,</p>
    <p style="color:#374151;margin:0 0 16px">
      Thank you for taking the time to submit your UAT feedback for AMIS.
      Your response has been received and forwarded to the development team.
    </p>
    <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#6b7280;width:120px;font-size:13px">Institute</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600">${data.vtiName}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Role</td><td style="padding:4px 0;color:#111827;font-size:13px">${data.role}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Submitted</td><td style="padding:4px 0;color:#111827;font-size:13px">${data.testDate ?? new Date().toISOString().split("T")[0]}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Overall rating</td><td style="padding:4px 0;color:#f59e0b;font-size:14px;letter-spacing:2px">${"★".repeat(data.overallRating)}${"☆".repeat(5 - data.overallRating)}</td></tr>
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0 0 8px">
      If you have additional feedback or need to follow up, reply to this email or contact us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb">${SUPPORT_EMAIL}</a>.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:0">We appreciate your contribution to making AMIS better.</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#94a3b8">
    AMIS — Academic Management Information System · 3B Solutions Ltd
  </div>
</div>
</body>
</html>`;

      const confirmText = `Hello ${data.testerName},\n\nThank you for submitting your UAT feedback for AMIS.\n\nInstitute: ${data.vtiName}\nRole: ${data.role}\nOverall rating: ${data.overallRating}/5\n\nYour response has been received and forwarded to the development team.\n\nIf you have additional feedback, contact us at ${SUPPORT_EMAIL}.\n\nAMIS — Academic Management Information System`;

      // Fire-and-forget — confirmation failure must not block the main response
      sendMail({
        to: data.email,
        subject: `Feedback received — AMIS UAT (${data.vtiName})`,
        html: confirmHtml,
        text: confirmText,
      }).catch((err) =>
        req.log.error({ err }, "[feedback] confirmation email failed"),
      );

      return reply.status(200).send({ ok: true });
    },
  );
}
