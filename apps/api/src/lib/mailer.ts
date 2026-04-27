/**
 * Mailer — thin wrapper around nodemailer.
 *
 * Reads SMTP settings from environment variables:
 *   SMTP_HOST   — mail server hostname (e.g. smtp.gmail.com)
 *   SMTP_PORT   — port, default 587
 *   SMTP_USER   — login username
 *   SMTP_PASS   — login password
 *   SMTP_FROM   — "From" address, default "AMIS <noreply@amis.local>"
 *   SMTP_SECURE — "true" for TLS (port 465), otherwise STARTTLS
 *
 * When SMTP_HOST / SMTP_USER / SMTP_PASS are not set the mailer logs
 * the would-be message to stdout instead of throwing, so the rest of the
 * application continues to work without email infrastructure configured.
 */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "AMIS <noreply@amis.local>";
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

export interface MailOptions {
  to: string | string[];
  subject: string;
  /** Full HTML body. */
  html: string;
  /** Plain-text fallback (auto-derived from html if omitted). */
  text?: string;
}

/**
 * Send an email.  Never throws — logs errors and silently degrades when
 * SMTP is not configured.
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  const to = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;

  if (!transporter) {
    console.log(
      `[mailer] SMTP not configured — skipping email to: ${to} | Subject: ${opts.subject}`,
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    console.log(`[mailer] Sent "${opts.subject}" to ${to} (messageId: ${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] Failed to send "${opts.subject}" to ${to}:`, err);
  }
}

/**
 * Build a simple branded HTML email body.
 */
export function buildEmailHtml(title: string, body: string, link?: string): string {
  const linkHtml = link
    ? `<p style="margin-top:24px">
         <a href="${link}" style="background:#2563EB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
           View in AMIS →
         </a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:0">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#2563EB;padding:20px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">AMIS — Academic Management</h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1e293b;margin-top:0">${title}</h2>
      <p style="color:#475569;line-height:1.6">${body}</p>
      ${linkHtml}
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#94a3b8">
      This is an automated notification from AMIS. Please do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}
