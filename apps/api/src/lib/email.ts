import { Resend } from "resend";
import nodemailer from "nodemailer";

// ── Resend transport ─────────────────────────────────────────────────────────
const RESEND_FROM = process.env.RESEND_FROM ?? "AMIS <noreply@amis.institute>";

// ── SMTP transport (takes priority when SMTP_HOST / SMTP_USER / SMTP_PASS set) ─
const SMTP_HOST   = process.env.SMTP_HOST;
const SMTP_PORT   = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER   = process.env.SMTP_USER;
const SMTP_PASS   = process.env.SMTP_PASS;
const SMTP_FROM   = process.env.SMTP_FROM ?? "AMIS <noreply@amis.institute>";
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/** True when any transactional email transport is configured. */
export function isEmailConfigured(): boolean {
  return Boolean(
    (SMTP_HOST && SMTP_USER && SMTP_PASS) || process.env.RESEND_API_KEY,
  );
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  // ── 1. Prefer SMTP when credentials are present ────────────────────────────
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: SMTP_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? options.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      });
      console.log(`[email] SMTP sent "${options.subject}" to ${options.to} (${info.messageId})`);
      return;
    } catch (err) {
      console.error(`[email] SMTP error sending "${options.subject}" to ${options.to}:`, err);
      return;
    }
  }

  // ── 2. Fall back to Resend ─────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    if (error) {
      console.error(`[email] Resend error sending "${options.subject}" to ${options.to}:`, error.message);
    }
    return;
  }

  // ── 3. Nothing configured — log and continue ───────────────────────────────
  console.warn(
    `[email] No transport configured — skipping email to ${options.to} (subject: "${options.subject}")`,
  );
}

export function buildPasswordResetEmail(resetUrl: string): { html: string; text: string } {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">Password Reset Request</h2>
      <p>You requested a password reset for your AMIS account.</p>
      <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        If you did not request this, you can safely ignore this email.
        Your password will not change unless you click the link above.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;">AMIS — Academic Management Information System</p>
    </div>
  `;

  const text = `
Password Reset Request

You requested a password reset for your AMIS account.

Click the link below to reset your password. This link expires in 1 hour.

${resetUrl}

If you did not request this, you can safely ignore this email.
  `.trim();

  return { html, text };
}

export function buildWelcomeEmail(
  setupUrl: string,
  firstName?: string | null,
): { html: string; text: string } {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">Welcome to AMIS</h2>
      <p>${greeting}</p>
      <p>
        An account has been created for you on the <strong>Academic Management Information System (AMIS)</strong>.
        To get started, click the button below to set up your password.
        This link expires in <strong>48 hours</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a href="${setupUrl}"
           style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Set Up Your Account
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        If you were not expecting this email, please contact your institution's administrator.
        Do not share this link with anyone.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;">AMIS — Academic Management Information System</p>
    </div>
  `;

  const text = `
${greeting}

An account has been created for you on the Academic Management Information System (AMIS).

To get started, click the link below to set up your password. This link expires in 48 hours.

${setupUrl}

If you were not expecting this email, please contact your institution's administrator.
Do not share this link with anyone.
  `.trim();

  return { html, text };
}
