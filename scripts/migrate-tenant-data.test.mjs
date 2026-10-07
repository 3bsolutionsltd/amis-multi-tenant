import test from "node:test";
import assert from "node:assert/strict";
import {
  EXCLUDED_TABLES,
  INSERT_ORDER,
  TENANT_TABLES,
  mapUsers,
  newPasswordHash,
  normalizeEmail,
  parseArgs,
  quoteTable,
} from "./migrate-tenant-data.mjs";

test("dry-run is the default and tenant slugs are parsed", () => {
  const options = parseArgs([
    "--source-slug=st-simon-peters",
    "--target-slug=st-simon-peters",
  ]);

  assert.equal(options.apply, false);
  assert.equal(options.sourceSlug, "st-simon-peters");
  assert.equal(options.targetSlug, "st-simon-peters");
});

test("apply requires explicit production and source-pause confirmations", () => {
  const options = parseArgs([
    "--apply",
    "--confirm-source-paused",
    "--confirm-production-write",
    "--approval-reference=approved-by-institute",
    "--backup-reference=verified-backup",
  ]);

  assert.equal(options.apply, true);
  assert.equal(options.confirmSourcePaused, true);
  assert.equal(options.confirmProductionWrite, true);
  assert.equal(options.approvalReference, "approved-by-institute");
  assert.equal(options.backupReference, "verified-backup");
});

test("unknown options are rejected", () => {
  assert.throws(() => parseArgs(["--force"]), /Unknown argument/);
});

test("migration allowlist includes approved configuration and non-student modules", () => {
  assert.ok(TENANT_TABLES.includes("platform.config_versions"));
  assert.ok(TENANT_TABLES.includes("platform.iam_audit_log"));
  assert.ok(TENANT_TABLES.includes("app.staff_profiles"));
  assert.ok(TENANT_TABLES.includes("app.inventory_items"));
  assert.ok(TENANT_TABLES.includes("app.assets"));
  assert.ok(INSERT_ORDER.includes("platform.config_audit"));
});

test("student and runtime tables are explicitly excluded", () => {
  for (const table of [
    "app.students",
    "app.admission_applications",
    "app.attendance",
    "app.mark_entries",
    "app.payments",
    "app.term_registrations",
    "app.workflow_instances",
    "platform.outbox_events",
    "platform.refresh_tokens",
  ]) {
    assert.ok(EXCLUDED_TABLES.includes(table), `${table} should be excluded`);
    assert.ok(!TENANT_TABLES.includes(table), `${table} must not be included`);
  }
});

test("every allowlisted table has an import order and no table is both included and excluded", () => {
  assert.equal(new Set(TENANT_TABLES).size, TENANT_TABLES.length);
  assert.deepEqual(
    TENANT_TABLES.filter((table) => !INSERT_ORDER.includes(table)),
    [],
  );
  assert.deepEqual(
    TENANT_TABLES.filter((table) => EXCLUDED_TABLES.includes(table)),
    [],
  );
});

test("user mapping is case-insensitive and rejects unrelated target accounts", async () => {
  const result = await mapUsers(
    [{ id: "source-id", email: "Admin@Example.com" }],
    [{ id: "target-id", email: "admin@example.com" }],
  );
  assert.equal(result.map.get("source-id"), "target-id");

  await assert.rejects(
    mapUsers(
      [{ id: "source-id", email: "admin@example.com" }],
      [{ id: "target-id", email: "other@example.com" }],
    ),
    /not present in the source/,
  );
});

test("identifiers are quoted and email normalization is case-insensitive", () => {
  assert.equal(quoteTable("app.some_table"), '"app"."some_table"');
  assert.equal(normalizeEmail("  Admin@Example.COM "), "admin@example.com");
});

test("generated migration password hashes use the application scrypt format", () => {
  const hash = newPasswordHash();
  const [salt, key] = hash.split(":");

  assert.match(salt, /^[0-9a-f]{64}$/);
  assert.match(key, /^[0-9a-f]{128}$/);
});
