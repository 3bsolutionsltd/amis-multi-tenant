#!/usr/bin/env node
/**
 * provision-tenant.js — Pre-provision an institute tenant + initial admin user.
 *
 * Addresses Issue #147 (pre-provision admin accounts) from the demo report.
 * Run on the staging/prod host to onboard a new institute BEFORE the demo,
 * so the institute admin can sign in immediately with credentials handed
 * over via secure channel (sealed envelope / encrypted message).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/provision-tenant.js \
 *     --slug greenfield-vti \
 *     --name "Greenfield Vocational Training Institute" \
 *     --email admin@greenfield.ac.ug \
 *     --first "Jane" --last "Mukasa" \
 *     [--password <plain>]      # optional; otherwise a 16-char random pw is generated
 *
 * Output:
 *   Prints the slug, login URL and a one-time password to stdout.
 *   The password is also written to ./provisioned-<slug>.txt for filing.
 *
 * Notes:
 *   - Idempotent on slug+email: re-running with the same slug+email resets
 *     the admin password to a new value (useful for "forgot password" via
 *     out-of-band channel).
 *   - Requires bcryptjs (already a workspace dependency of apps/api).
 */

"use strict";

const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key] = val;
  }
  return out;
}

function generatePassword(len = 16) {
  // Crockford-ish alphabet — no ambiguous chars
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  const name = args.name;
  const email = args.email && args.email.toLowerCase();
  const firstName = args.first ?? null;
  const lastName = args.last ?? null;
  let password = args.password;

  if (!slug || !name || !email) {
    console.error(
      "Usage: node scripts/provision-tenant.js --slug <slug> --name <name> --email <email> [--first <first>] [--last <last>] [--password <pw>]"
    );
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL env var is required.");
    process.exit(2);
  }

  if (!password) password = generatePassword(16);

  const passwordHash = await bcrypt.hash(password, 12);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // 1) Upsert tenant by slug
    const tenantRes = await client.query(
      `INSERT INTO platform.tenants (slug, name)
         VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, slug, name`,
      [slug, name]
    );
    const tenant = tenantRes.rows[0];

    // 2) Upsert admin user by (tenant_id, email); reset password on conflict
    const userRes = await client.query(
      `INSERT INTO platform.users
         (tenant_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, 'admin', $4, $5)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role          = 'admin',
             first_name    = COALESCE(EXCLUDED.first_name, platform.users.first_name),
             last_name     = COALESCE(EXCLUDED.last_name,  platform.users.last_name)
       RETURNING id, email, role, first_name, last_name`,
      [tenant.id, email, passwordHash, firstName, lastName]
    );
    const user = userRes.rows[0];

    await client.query("COMMIT");

    // 3) Write a sealed credentials file for secure handover
    const outFile = path.join(process.cwd(), `provisioned-${slug}.txt`);
    const body = [
      "AMIS — Institute Provisioning",
      "═════════════════════════════════════════════════════════════",
      `Institute       : ${tenant.name}`,
      `Institution code: ${tenant.slug}`,
      `Admin email     : ${user.email}`,
      `Temporary pwd   : ${password}`,
      "",
      "Login URL: https://pre.amis.institute/login",
      "         (use the institution code above when prompted)",
      "",
      "First-time tasks for the admin:",
      "  1. Change the password under Profile → Security.",
      "  2. Invite additional staff under Users.",
      "  3. Review institute settings.",
      "",
      "Deliver this file to the admin via a secure, encrypted channel",
      "(sealed envelope, password-protected ZIP, encrypted messenger).",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");
    fs.writeFileSync(outFile, body, { encoding: "utf8", mode: 0o600 });

    console.log(body);
    console.log("");
    console.log(`Credentials also written to ${outFile} (mode 0600).`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Provisioning failed:", err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
