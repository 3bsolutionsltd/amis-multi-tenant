import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EXCLUDED_TABLES,
  INSERT_ORDER,
  TENANT_TABLES,
  assertAccountBootstrap,
  findPotentialSecretPaths,
  isCompatiblePasswordHash,
  mapUsers,
  newPasswordHash,
  normalizeEmail,
  orderTablesByDependencies,
  parseArgs,
  prepareReferencedUploads,
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
    "--confirm-secrets-reviewed",
    "--adopt-source-identity",
    "--write-upload-manifest=/tmp/tenant-uploads.txt",
  ]);

  assert.equal(options.apply, true);
  assert.equal(options.confirmSourcePaused, true);
  assert.equal(options.confirmProductionWrite, true);
  assert.equal(options.approvalReference, "approved-by-institute");
  assert.equal(options.backupReference, "verified-backup");
  assert.equal(options.confirmSecretsReviewed, true);
  assert.equal(options.adoptSourceIdentity, true);
  assert.equal(options.uploadManifestPath, "/tmp/tenant-uploads.txt");
});

test("unknown options are rejected", () => {
  assert.throws(() => parseArgs(["--force"]), /Unknown argument/);
});

test("migration allowlist includes student, workflow, configuration, and institute modules", () => {
  assert.ok(TENANT_TABLES.includes("platform.config_versions"));
  assert.ok(TENANT_TABLES.includes("platform.iam_audit_log"));
  assert.ok(TENANT_TABLES.includes("app.students"));
  assert.ok(TENANT_TABLES.includes("app.admission_applications"));
  assert.ok(TENANT_TABLES.includes("app.mark_entries"));
  assert.ok(TENANT_TABLES.includes("app.payments"));
  assert.ok(TENANT_TABLES.includes("app.student_documents"));
  assert.ok(TENANT_TABLES.includes("app.workflow_instances"));
  assert.ok(TENANT_TABLES.includes("app.notifications"));
  assert.ok(TENANT_TABLES.includes("app.staff_profiles"));
  assert.ok(TENANT_TABLES.includes("app.inventory_items"));
  assert.ok(TENANT_TABLES.includes("app.assets"));
  assert.ok(INSERT_ORDER.includes("platform.config_audit"));
});

test("only transient authentication and transport tables are excluded", () => {
  for (const table of [
    "platform.outbox_events",
    "platform.sync_received_events",
    "platform.refresh_tokens",
    "platform.password_reset_tokens",
    "platform.tenant_email_verifications",
    "platform.otp_sessions",
  ]) {
    assert.ok(EXCLUDED_TABLES.includes(table), `${table} should be excluded`);
    assert.ok(!TENANT_TABLES.includes(table), `${table} must not be included`);
  }
  for (const table of [
    "app.students",
    "app.admission_applications",
    "app.attendance",
    "app.mark_entries",
    "app.payments",
    "app.term_registrations",
    "app.workflow_instances",
  ]) {
    assert.ok(TENANT_TABLES.includes(table), `${table} should be included`);
    assert.ok(!EXCLUDED_TABLES.includes(table), `${table} must not be excluded`);
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

test("source users can bootstrap an empty tenant only when adopting source identity", () => {
  const sourceUsers = [{ id: "source-user", email: "admin@example.com" }];
  assert.doesNotThrow(() => assertAccountBootstrap(sourceUsers, [], true));
  assert.throws(
    () => assertAccountBootstrap(sourceUsers, [], false),
    /initial admin first/,
  );
  assert.throws(
    () => assertAccountBootstrap([], [], true),
    /no user accounts/,
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
  assert.equal(isCompatiblePasswordHash(hash), true);
  assert.equal(isCompatiblePasswordHash("invalid"), false);
});

test("table import order respects discovered foreign-key dependencies", () => {
  const ordered = orderTablesByDependencies(
    ["app.child", "app.parent", "app.independent"],
    [{ child_table: "app.child", parent_table: "app.parent" }],
  );
  assert.ok(ordered.indexOf("app.parent") < ordered.indexOf("app.child"));
  assert.equal(ordered.length, 3);
  assert.throws(
    () =>
      orderTablesByDependencies(
        ["app.first", "app.second"],
        [
          { child_table: "app.first", parent_table: "app.second" },
          { child_table: "app.second", parent_table: "app.first" },
        ],
      ),
    /Circular table dependencies/,
  );
});

test("secret scanning reports key paths without exposing values", () => {
  const paths = new Set();
  findPotentialSecretPaths(
    { payload: '{"mail":{"apiKey":"do-not-print","sender":"AMIS"}}' },
    "platform.config_versions",
    paths,
  );
  assert.deepEqual([...paths], ["platform.config_versions.payload.mail.apiKey"]);
  assert.ok(![...paths].join("\n").includes("do-not-print"));
});

test("referenced uploads are staged, verified, finalized, and rollbackable", async () => {
  const root = await mkdtemp(join(tmpdir(), "amis-migration-test-"));
  const sourceUploadsDir = join(root, "source");
  const targetUploadsDir = join(root, "target");
  await Promise.all([mkdir(sourceUploadsDir), mkdir(targetUploadsDir)]);
  await writeFile(join(sourceUploadsDir, "student-record.pdf"), "test document");
  try {
    const staged = await prepareReferencedUploads(
      ["/uploads/student-record.pdf"],
      { sourceUploadsDir, targetUploadsDir },
    );
    await assert.rejects(readFile(join(targetUploadsDir, "student-record.pdf")));
    await staged.finalize();
    assert.equal(
      await readFile(join(targetUploadsDir, "student-record.pdf"), "utf8"),
      "test document",
    );
    await staged.rollback();
    await assert.rejects(readFile(join(targetUploadsDir, "student-record.pdf")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("referenced upload transfer rejects unsafe paths and existing target files", async () => {
  const root = await mkdtemp(join(tmpdir(), "amis-migration-test-"));
  const sourceUploadsDir = join(root, "source");
  const targetUploadsDir = join(root, "target");
  await Promise.all([mkdir(sourceUploadsDir), mkdir(targetUploadsDir)]);
  await writeFile(join(sourceUploadsDir, "existing.pdf"), "source");
  await writeFile(join(targetUploadsDir, "existing.pdf"), "target");
  try {
    await assert.rejects(
      prepareReferencedUploads(
        ["/uploads/../outside.pdf"],
        { sourceUploadsDir, targetUploadsDir },
      ),
      /unsupported path format/,
    );
    await assert.rejects(
      prepareReferencedUploads(
        ["/uploads/existing.pdf"],
        { sourceUploadsDir, targetUploadsDir },
      ),
      /already exists/,
    );
    assert.equal(await readFile(join(targetUploadsDir, "existing.pdf"), "utf8"), "target");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
