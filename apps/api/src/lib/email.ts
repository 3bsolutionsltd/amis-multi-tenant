import { Resend } from "resend";

const FROM = "AMIS <noreply@amis.institute>";

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[email] RESEND_API_KEY environment variable is required. Add it to .env before starting the server.",
    );
  }
  return new Resend(apiKey);
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
  if (error) {
    throw new Error(`[email] Resend error: ${error.message}`);
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
