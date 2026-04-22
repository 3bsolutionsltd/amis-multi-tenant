/**
 * SMS notification service
 *
 * Supports two Ugandan SMS gateways (env-driven):
 *   - Africa's Talking (SMS_PROVIDER=africas-talking, default)
 *   - Yo! Uganda       (SMS_PROVIDER=yo-uganda)
 *
 * Falls back to console.log when SMS_API_KEY / credentials are absent so
 * development works without any external service.
 *
 * Required env vars (Africa's Talking):
 *   SMS_PROVIDER=africas-talking   (optional, this is the default)
 *   SMS_API_KEY                    — API key from AT dashboard
 *   SMS_SENDER_ID                  — shortcode / sender (optional, defaults to "AMIS")
 *   AT_USERNAME                    — AT account username (defaults to "sandbox" in dev)
 *
 * Required env vars (Yo! Uganda):
 *   SMS_PROVIDER=yo-uganda
 *   YO_PARTNER_ID                  — Yo! Uganda partner identifier
 *   YO_PARTNER_PASSWORD            — Yo! Uganda password
 *   SMS_SENDER_ID                  — optional override
 */

import https from "https";
import http from "http";
import querystring from "querystring";

const PROVIDER = (process.env.SMS_PROVIDER ?? "africas-talking").toLowerCase();

// ------------------------------------------------------------------ helpers

function log(message: string): void {
  console.log(`[SMS] Would send: ${message}`);
}

function httpsPost(
  options: https.RequestOptions,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = options.protocol === "http:" ? http : https;
    const req = (mod as typeof https).request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ------------------------------------------------------------------ providers

async function sendViaAfricasTalking(phone: string, message: string): Promise<void> {
  const apiKey = process.env.SMS_API_KEY;
  const username = process.env.AT_USERNAME ?? "sandbox";
  const from = process.env.SMS_SENDER_ID ?? undefined; // AT ignores empty string

  if (!apiKey) {
    log(message);
    return;
  }

  const params: Record<string, string> = {
    username,
    to: normalizePhone(phone),
    message,
  };
  if (from) params.from = from;

  const body = querystring.stringify(params);

  const { status, body: resBody } = await httpsPost(
    {
      hostname: "api.africastalking.com",
      path: "/version1/messaging",
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body,
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Africa's Talking SMS error ${status}: ${resBody}`);
  }
}

async function sendViaYoUganda(phone: string, message: string): Promise<void> {
  const partnerId = process.env.YO_PARTNER_ID;
  const partnerPassword = process.env.YO_PARTNER_PASSWORD;
  const from = process.env.SMS_SENDER_ID ?? "AMIS";

  if (!partnerId || !partnerPassword) {
    log(message);
    return;
  }

  // Yo! Uganda uses a simple XML/HTTP POST API
  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>sendSMS</methodName>
  <params>
    <param><value><string>${escapeXml(partnerId)}</string></value></param>
    <param><value><string>${escapeXml(partnerPassword)}</string></value></param>
    <param><value><string>${escapeXml(normalizePhone(phone))}</string></value></param>
    <param><value><string>${escapeXml(message)}</string></value></param>
    <param><value><string>${escapeXml(from)}</string></value></param>
  </params>
</methodCall>`;

  const { status, body: resBody } = await httpsPost(
    {
      hostname: "www.yo.co.ug",
      path: "/services/sms/sendsms.php",
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "Content-Length": Buffer.byteLength(xmlBody),
      },
    },
    xmlBody,
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Yo! Uganda SMS error ${status}: ${resBody}`);
  }
  if (resBody.includes("faultCode")) {
    throw new Error(`Yo! Uganda SMS fault: ${resBody}`);
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalize phone to international format for Uganda (+256…).
 * Accepts: 07XXXXXXXX, 7XXXXXXXX, +2567XXXXXXXX, 2567XXXXXXXX
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  // Return as-is with + if not already there
  return phone.startsWith("+") ? phone : `+${digits}`;
}

// ------------------------------------------------------------------ public API

/**
 * Send an SMS message to a phone number.
 * Silently falls back to console.log when credentials are not configured.
 * Throws on network/gateway errors (caller should catch and handle).
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  if (!phone) return;

  if (PROVIDER === "yo-uganda") {
    return sendViaYoUganda(phone, message);
  }
  return sendViaAfricasTalking(phone, message);
}

// ------------------------------------------------------------------ message builders

export function buildPaymentConfirmationSms(opts: {
  studentName: string;
  amount: number;
  currency: string;
  reference: string;
  balance?: number;
}): string {
  const { studentName, amount, currency, reference, balance } = opts;
  const amountFmt = `${currency} ${Number(amount).toLocaleString()}`;
  let msg = `Dear ${studentName}, payment of ${amountFmt} received. Ref: ${reference}.`;
  if (balance !== undefined) {
    msg += ` Outstanding: ${currency} ${Number(balance).toLocaleString()}.`;
  }
  msg += " Thank you — AMIS";
  return msg;
}

export function buildAdmissionEnrolledSms(opts: {
  studentName: string;
  admissionNumber: string;
  programme?: string | null;
}): string {
  const { studentName, admissionNumber, programme } = opts;
  let msg = `Congratulations ${studentName}! You have been enrolled. Admission No: ${admissionNumber}.`;
  if (programme) msg += ` Programme: ${programme}.`;
  msg += " Welcome — AMIS";
  return msg;
}
