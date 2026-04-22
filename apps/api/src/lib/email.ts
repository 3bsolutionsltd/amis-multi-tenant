import nodemailer, { type Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host) {
    // Return a test/preview transport if no SMTP configured
    _transporter = nodemailer.createTransport({
      jsonTransport: true,
    } as Parameters<typeof nodemailer.createTransport>[0]);
  } else {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  return _transporter;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const from =
    process.env.SMTP_FROM ?? `"AMIS" <noreply@${process.env.SMTP_HOST ?? "example.com"}>`;

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  // If using jsonTransport (no SMTP configured), log to console
  if (process.env.NODE_ENV !== "production" && (info as { message?: unknown }).message) {
    console.log("[EMAIL] Would send:", JSON.stringify((info as { message?: unknown }).message, null, 2));
  }
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
