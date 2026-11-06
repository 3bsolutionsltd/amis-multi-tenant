#!/usr/bin/env node

import { createRequire } from "node:module";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdtemp,
  realpath,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants, createReadStream } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const apiPackage = existsSync("/app/apps/api/package.json")
  ? "/app/apps/api/package.json"
  : resolve("apps/api/package.json");
const require = createRequire(apiPackage);

function getPgClient() {
  const { Client, types } = require("pg");
  types.setTypeParser(20, (value) => value);
  types.setTypeParser(1700, (value) => value);
  types.setTypeParser(1114, (value) => value);
  types.setTypeParser(1184, (value) => value);
  types.setTypeParser(1082, (value) => value);
  types.setTypeParser(114, (value) => value);
  types.setTypeParser(3802, (value) => value);
  return Client;
}

const TENANT_TABLES = [
  "platform.config_versions",
  "platform.config_audit",
  "platform.tenant_settings",
  "platform.iam_audit_log",
  "app.academic_years",
  "app.programmes",
  "app.courses",
  "app.terms",
  "app.course_offerings",
  "app.grading_scales",
  "app.fee_structures",
  "app.timetable_slots",
  "app.staff_profiles",
  "app.staff_contracts",
  "app.staff_attendance",
  "app.staff_appraisals",
  "app.staff_cpd",
  "app.instructor_reports",
  "app.suppliers",
  "app.purchase_requisitions",
  "app.purchase_requisition_items",
  "app.purchase_orders",
  "app.purchase_order_items",
  "app.goods_received_notes",
  "app.grn_items",
  "app.inventory_items",
  "app.master_assets",
  "app.assets",
  "app.stock_transactions",
  "app.store_issuances",
  "app.store_issuance_items",
  "app.stock_takes",
  "app.stock_take_items",
  "app.inventory_replenishment_requests",
  "app.inventory_audit_log",
  "app.store_requisitions",
  "app.store_requisition_items",
  "app.petty_cash_vouchers",
  "app.petty_cash_voucher_items",
  "app.students",
  "app.admission_applications",
  "app.admission_import_batches",
  "app.attendance",
  "app.clearance_signoffs",
  "app.fee_audit_log",
  "app.field_placements",
  "app.industrial_training",
  "app.it_log_entries",
  "app.it_reports",
  "app.mark_audit_log",
  "app.mark_entries",
  "app.mark_submissions",
  "app.payments",
  "app.alumni",
  "app.schoolpay_transactions",
  "app.student_documents",
  "app.student_projects",
  "app.term_gpa",
  "app.term_registration_doc_checks",
  "app.term_registrations",
  "app.term_results",
  "app.teacher_evaluations",
  "app.workflow_events",
  "app.workflow_instances",
  "app.notifications",
];

const RELATED_TABLES = ["app.grade_boundaries"];

const EXCLUDED_TABLES = [
  "platform.outbox_events",
  "platform.sync_received_events",
  "platform.refresh_tokens",
  "platform.password_reset_tokens",
  "platform.tenant_email_verifications",
  "platform.otp_sessions",
];

const INSERT_ORDER = [
  "platform.config_versions",
  "platform.tenant_settings",
  "app.academic_years",
  "app.programmes",
  "app.courses",
  "app.terms",
  "app.staff_profiles",
  "app.course_offerings",
  "app.grading_scales",
  "app.grade_boundaries",
  "app.fee_structures",
  "app.timetable_slots",
  "app.staff_contracts",
  "app.staff_attendance",
  "app.staff_appraisals",
  "app.staff_cpd",
  "app.instructor_reports",
  "app.suppliers",
  "app.purchase_requisitions",
  "app.purchase_requisition_items",
  "app.purchase_orders",
  "app.purchase_order_items",
  "app.goods_received_notes",
  "app.grn_items",
  "app.inventory_items",
  "app.master_assets",
  "app.assets",
  "app.stock_transactions",
  "app.store_issuances",
  "app.store_issuance_items",
  "app.stock_takes",
  "app.stock_take_items",
  "app.inventory_replenishment_requests",
  "app.inventory_audit_log",
  "app.store_requisitions",
  "app.store_requisition_items",
  "app.petty_cash_vouchers",
  "app.petty_cash_voucher_items",
  "platform.config_audit",
  "platform.iam_audit_log",
  "app.students",
  "app.admission_applications",
  "app.admission_import_batches",
  "app.attendance",
  "app.clearance_signoffs",
  "app.fee_audit_log",
  "app.field_placements",
  "app.industrial_training",
  "app.it_log_entries",
  "app.it_reports",
  "app.mark_audit_log",
  "app.mark_entries",
  "app.mark_submissions",
  "app.payments",
  "app.alumni",
  "app.schoolpay_transactions",
  "app.student_documents",
  "app.student_projects",
  "app.term_gpa",
  "app.term_registration_doc_checks",
  "app.term_registrations",
  "app.term_results",
  "app.teacher_evaluations",
  "app.workflow_events",
  "app.workflow_instances",
  "app.notifications",
];

const USER_SAFE_COLUMNS = [
  "email",
  "role",
  "first_name",
  "last_name",
  "department",
  "is_active",
  "created_at",
];

const TENANT_SETUP_COLUMNS = [
  "slug",
  "ownership_type",
  "uvtab_centre_code",
  "license_number",
  "license_date",
  "license_status",
  "setup_completed",
  "setup_completed_at",
  "name",
  "contact_email",
  "address",
  "phone",
  "logo_url",
];

const USER_TABLES_HANDLED_SEPARATELY = ["platform.users", "platform.roles"];
const SECRET_KEY_PATTERN = /password|secret|token|api[_-]?key|credential|private[_-]?key/i;
const UPLOAD_REFERENCE_PATTERN = /\/uploads\/([A-Za-z0-9_-][A-Za-z0-9._-]*)/g;
const USER_REFERENCE_COLUMNS = new Map([
  ["platform.iam_audit_log", ["actor_id", "target_id"]],
  ["app.inventory_audit_log", ["actor_id"]],
  ["app.workflow_events", ["actor_user_id"]],
  ["app.mark_submissions", ["created_by"]],
  ["app.fee_audit_log", ["actor_user_id"]],
  ["app.mark_audit_log", ["actor_user_id"]],
  ["app.term_registrations", ["created_by"]],
  ["app.industrial_training", ["created_by"]],
  ["app.field_placements", ["created_by"]],
  ["app.student_projects", ["created_by"]],
  ["app.notifications", ["user_id"]],
  ["app.term_registration_doc_checks", ["reviewed_by"]],
]);

function parseArgs(argv) {
  const options = {
    apply: false,
    sourceSlug: "",
    targetSlug: "",
    approvalReference: "",
    backupReference: "",
    confirmSourcePaused: false,
    confirmProductionWrite: false,
    confirmSecretsReviewed: false,
    adoptSourceIdentity: false,
    uploadManifestPath: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--confirm-source-paused") options.confirmSourcePaused = true;
    else if (arg === "--confirm-production-write") options.confirmProductionWrite = true;
    else if (arg === "--confirm-secrets-reviewed") options.confirmSecretsReviewed = true;
    else if (arg === "--adopt-source-identity") options.adoptSourceIdentity = true;
    else if (arg.startsWith("--write-upload-manifest=")) {
      options.uploadManifestPath = arg.slice("--write-upload-manifest=".length);
    }
    else if (arg.startsWith("--source-slug=")) options.sourceSlug = arg.slice(14);
    else if (arg.startsWith("--target-slug=")) options.targetSlug = arg.slice(14);
    else if (arg.startsWith("--approval-reference=")) options.approvalReference = arg.slice(21);
    else if (arg.startsWith("--backup-reference=")) options.backupReference = arg.slice(19);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteTable(table) {
  return table.split(".").map(quoteIdentifier).join(".");
}

function newPasswordHash() {
  const password = randomBytes(48);
  const salt = randomBytes(32);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function getTenant(client, slug) {
  const result = await client.query(
    `SELECT id, slug, name, is_active,
            contact_email, address, phone, logo_url,
            ownership_type, uvtab_centre_code, license_number, license_date,
            license_status, setup_completed, setup_completed_at
     FROM platform.tenants WHERE slug = $1`,
    [slug],
  );
  if (result.rowCount !== 1) throw new Error(`Expected exactly one tenant for slug '${slug}'`);
  if (!result.rows[0].is_active) throw new Error(`Tenant '${slug}' is inactive`);
  return result.rows[0];
}

async function getDatabaseIdentity(client) {
  const result = await client.query(
    `SELECT current_database() AS database_name,
            system_identifier::text
     FROM pg_control_system()`,
  );
  return result.rows[0];
}

async function getMigrationVersion(client) {
  const result = await client.query(
    `SELECT count(*)::int AS count, max(version)::text AS latest FROM schema_migrations`,
  );
  return result.rows[0];
}

async function assertElevatedRole(client, label) {
  const result = await client.query(
    `SELECT rolsuper OR rolbypassrls AS can_bypass
     FROM pg_roles WHERE rolname = current_user`,
  );
  if (!result.rows[0]?.can_bypass) {
    throw new Error(`${label} connection must use a database role that bypasses RLS`);
  }
}

async function getColumns(client, table) {
  const [schema, name] = table.split(".");
  const result = await client.query(
    `SELECT column_name, is_generated, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, name],
  );
  if (result.rowCount === 0) throw new Error(`Required table is missing: ${table}`);
  return result.rows;
}

async function assertTableCompatibility(source, target) {
  for (const table of [...TENANT_TABLES, ...RELATED_TABLES]) {
    const [sourceColumns, targetColumns] = await Promise.all([
      getColumns(source, table),
      getColumns(target, table),
    ]);
    const sourceShape = sourceColumns.map((column) =>
      [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
    );
    const targetShape = targetColumns.map((column) =>
      [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
    );
    if (sourceShape.join("\0") !== targetShape.join("\0")) {
      throw new Error(`Source/target column mismatch for ${table}`);
    }
    const sourceNames = sourceColumns.map((column) => column.column_name);
    if (!sourceNames.includes("id")) throw new Error(`Expected primary id column in ${table}`);
    if (TENANT_TABLES.includes(table) && !sourceNames.includes("tenant_id")) {
      throw new Error(`Expected tenant_id column in ${table}`);
    }
  }
  const [sourceUsers, targetUsers] = await Promise.all([
    getColumns(source, "platform.users"),
    getColumns(target, "platform.users"),
  ]);
  const sourceUserShape = sourceUsers.map((column) =>
    [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
  );
  const targetUserShape = targetUsers.map((column) =>
    [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
  );
  if (sourceUserShape.join("\0") !== targetUserShape.join("\0")) {
    throw new Error("Source/target column mismatch for platform.users");
  }
  const sourceUserNames = sourceUsers.map((column) => column.column_name);
  for (const column of USER_SAFE_COLUMNS) {
    if (!sourceUserNames.includes(column)) throw new Error(`Required user column is missing: ${column}`);
  }
  if (!sourceUserNames.includes("password_hash")) {
    throw new Error("Required user column is missing: password_hash");
  }
  const [sourceRoles, targetRoles, sourceAssignments, targetAssignments] = await Promise.all([
    getColumns(source, "platform.roles"),
    getColumns(target, "platform.roles"),
    getColumns(source, "platform.user_roles"),
    getColumns(target, "platform.user_roles"),
  ]);
  const schemaShape = (columns) => columns.map((column) =>
    [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
  ).join("\0");
  if (
    schemaShape(sourceRoles) !== schemaShape(targetRoles) ||
    schemaShape(sourceAssignments) !== schemaShape(targetAssignments)
  ) {
    throw new Error("Source/target column mismatch for platform roles or user assignments");
  }
  const [sourceTenantColumns, targetTenantColumns] = await Promise.all([
    getColumns(source, "platform.tenants"),
    getColumns(target, "platform.tenants"),
  ]);
  const sourceTenantShape = sourceTenantColumns.map((column) =>
    [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
  );
  const targetTenantShape = targetTenantColumns.map((column) =>
    [column.column_name, column.data_type, column.udt_name, column.is_nullable].join(":"),
  );
  if (sourceTenantShape.join("\0") !== targetTenantShape.join("\0")) {
    throw new Error("Source/target column mismatch for platform.tenants");
  }
  await assertTenantTableCoverage(source);
  await assertTenantTableCoverage(target);
}

async function assertTenantTableCoverage(client) {
  const result = await client.query(
    `SELECT c.table_schema || '.' || c.table_name AS table_name
     FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema IN ('app', 'platform')
       AND c.column_name = 'tenant_id'
       AND t.table_type = 'BASE TABLE'
     GROUP BY c.table_schema, c.table_name`,
  );
  const handled = new Set([
    ...TENANT_TABLES,
    ...EXCLUDED_TABLES,
    ...USER_TABLES_HANDLED_SEPARATELY,
  ]);
  const unclassified = result.rows
    .map((row) => row.table_name)
    .filter((table) => !handled.has(table));
  if (unclassified.length > 0) {
    throw new Error(`Tenant-scoped tables need migration policy: ${unclassified.join(", ")}`);
  }
  const missing = [...handled]
    .filter((table) => TENANT_TABLES.includes(table))
    .filter((table) => !result.rows.some((row) => row.table_name === table));
  if (missing.length > 0) {
    throw new Error(`Expected tenant-scoped tables are missing: ${missing.join(", ")}`);
  }
}

async function getForeignKeyColumns(client) {
  const result = await client.query(
    `SELECT child_ns.nspname || '.' || child.relname AS child_table,
            child_attr.attname AS child_column,
            parent_ns.nspname || '.' || parent.relname AS parent_table,
            parent_attr.attname AS parent_column,
            NOT child_attr.attnotnull AS child_nullable
     FROM pg_constraint fk
     JOIN pg_class child ON child.oid = fk.conrelid
     JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
     JOIN pg_class parent ON parent.oid = fk.confrelid
     JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
     CROSS JOIN LATERAL unnest(fk.conkey) WITH ORDINALITY AS child_key(attnum, position)
     JOIN LATERAL unnest(fk.confkey) WITH ORDINALITY AS parent_key(attnum, position)
       ON parent_key.position = child_key.position
     JOIN pg_attribute child_attr
       ON child_attr.attrelid = child.oid AND child_attr.attnum = child_key.attnum
     JOIN pg_attribute parent_attr
       ON parent_attr.attrelid = parent.oid AND parent_attr.attnum = parent_key.attnum
     WHERE fk.contype = 'f'
       AND child_ns.nspname IN ('app', 'platform')`,
  );
  return result.rows;
}

function orderTablesByDependencies(tables, foreignKeys) {
  const tableSet = new Set(tables);
  const tableIndex = new Map(tables.map((table, index) => [table, index]));
  const prerequisites = new Map(tables.map((table) => [table, new Set()]));
  for (const foreignKey of foreignKeys) {
    if (
      tableSet.has(foreignKey.child_table) &&
      tableSet.has(foreignKey.parent_table) &&
      foreignKey.child_table !== foreignKey.parent_table
    ) {
      prerequisites.get(foreignKey.child_table).add(foreignKey.parent_table);
    }
  }
  const ordered = [];
  const remaining = new Set(tables);
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((table) => [...prerequisites.get(table)].every((parent) => !remaining.has(parent)))
      .sort((left, right) => tableIndex.get(left) - tableIndex.get(right));
    if (ready.length === 0) {
      throw new Error(`Circular table dependencies prevent safe import: ${[...remaining].join(", ")}`);
    }
    for (const table of ready) {
      remaining.delete(table);
      ordered.push(table);
    }
  }
  return ordered;
}

function getUserReferenceColumns(table, foreignKeys) {
  const columns = new Set(USER_REFERENCE_COLUMNS.get(table) ?? []);
  for (const foreignKey of foreignKeys) {
    if (foreignKey.child_table === table && foreignKey.parent_table === "platform.users" &&
        foreignKey.parent_column === "id") {
      columns.add(foreignKey.child_column);
    }
  }
  return columns;
}

async function findUnmappedUserReferences(client, tenantId, foreignKeys) {
  const unmapped = [];
  for (const table of TENANT_TABLES) {
    const columns = getUserReferenceColumns(table, foreignKeys);
    for (const column of columns) {
      const result = await client.query(
        `SELECT count(*)::int AS count
         FROM ${quoteTable(table)} source_row
         WHERE source_row.tenant_id = $1 AND source_row.${quoteIdentifier(column)} IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM platform.users user_row
             WHERE user_row.id = source_row.${quoteIdentifier(column)}
               AND user_row.tenant_id = $1
           )`,
        [tenantId],
      );
      if (Number(result.rows[0].count) > 0) {
        unmapped.push({ table, column, count: Number(result.rows[0].count) });
      }
    }
  }
  return unmapped;
}

function findPotentialSecretPaths(value, path, paths, depth = 0) {
  if (depth > 12 || value === null || value === undefined) return;
  if (Buffer.isBuffer(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPotentialSecretPaths(item, `${path}[${index}]`, paths, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = `${path}.${key}`;
      if (SECRET_KEY_PATTERN.test(key)) paths.add(nestedPath);
      findPotentialSecretPaths(nestedValue, nestedPath, paths, depth + 1);
    }
    return;
  }
  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    try {
      findPotentialSecretPaths(JSON.parse(value), path, paths, depth + 1);
    } catch {
      return;
    }
  }
}

async function countTenantRows(client, table, tenantId) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0].count;
}

async function* getRowBatches(client, table, tenantId, batchSize = 100) {
  let lastId = null;
  const pageSize = table === "app.student_documents" ? 1 : batchSize;
  while (true) {
    const result = table === "app.grade_boundaries"
      ? await client.query(
        `SELECT gb.*
         FROM app.grade_boundaries gb
         JOIN app.grading_scales gs ON gs.id = gb.grading_scale_id
         WHERE gs.tenant_id = $1 AND ($2::uuid IS NULL OR gb.id > $2::uuid)
         ORDER BY gb.id LIMIT $3`,
        [tenantId, lastId, pageSize],
      )
      : await client.query(
        `SELECT * FROM ${quoteTable(table)}
         WHERE tenant_id = $1 AND ($2::uuid IS NULL OR id > $2::uuid)
         ORDER BY id LIMIT $3`,
        [tenantId, lastId, pageSize],
      );
    if (result.rows.length === 0) return;
    yield result.rows;
    lastId = result.rows[result.rows.length - 1].id;
  }
}

async function countGradeBoundaryRows(client, tenantId) {
  const result = await client.query(
    `SELECT count(*)::int AS count
     FROM app.grade_boundaries gb
     JOIN app.grading_scales gs ON gs.id = gb.grading_scale_id
     WHERE gs.tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0].count;
}

async function getUsers(client, tenantId) {
  return client.query(
    `SELECT ${USER_SAFE_COLUMNS.map(quoteIdentifier).join(", ")}, password_hash, id
     FROM platform.users WHERE tenant_id = $1 ORDER BY lower(email), id`,
    [tenantId],
  ).then((result) => result.rows);
}

function assertCompatiblePasswordHashes(users) {
  for (const user of users) {
    if (!isCompatiblePasswordHash(user.password_hash)) {
      throw new Error("A source user has an unsupported password hash format");
    }
  }
}

function assertAccountBootstrap(sourceUsers, targetUsers, adoptSourceIdentity) {
  if (sourceUsers.length === 0) {
    throw new Error("Source tenant has no user accounts to bootstrap the destination");
  }
  if (targetUsers.length === 0 && !adoptSourceIdentity) {
    throw new Error("Provision the target tenant and its initial admin first");
  }
}

function isCompatiblePasswordHash(passwordHash) {
  return /^[0-9a-f]{64}:[0-9a-f]{128}$/i.test(passwordHash ?? "");
}

async function getRoles(client, tenantId) {
  return client.query(
    `SELECT id, name FROM platform.roles WHERE tenant_id = $1 ORDER BY name`,
    [tenantId],
  ).then((result) => result.rows);
}

async function getUserAssignments(client, tenantId) {
  return client.query(
    `SELECT u.id AS user_id, r.name AS role
     FROM platform.users u
     JOIN platform.user_roles ur ON ur.user_id = u.id
     JOIN platform.roles r ON r.id = ur.role_id
     WHERE u.tenant_id = $1
     ORDER BY u.id, r.name`,
    [tenantId],
  ).then((result) => result.rows);
}

async function mapUsers(sourceUsers, targetUsers) {
  const sourceByEmail = new Map();
  const targetByEmail = new Map();
  for (const user of sourceUsers) {
    const email = normalizeEmail(user.email);
    if (sourceByEmail.has(email)) throw new Error("Source has duplicate case-insensitive user emails");
    sourceByEmail.set(email, user);
  }
  for (const user of targetUsers) {
    const email = normalizeEmail(user.email);
    if (targetByEmail.has(email)) throw new Error("Target has duplicate case-insensitive user emails");
    targetByEmail.set(email, user);
  }
  for (const email of targetByEmail.keys()) {
    if (!sourceByEmail.has(email)) {
      throw new Error("Target tenant contains a user not present in the source tenant");
    }
  }
  const map = new Map();
  for (const [email, sourceUser] of sourceByEmail) {
    const targetUser = targetByEmail.get(email);
    if (targetUser) map.set(sourceUser.id, targetUser.id);
  }
  return { sourceByEmail, targetByEmail, map };
}

async function getPrimaryKeyCollisions(source, target, table, sourceTenantId) {
  let collisions = 0;
  for await (const rows of getRowBatches(source, table, sourceTenantId)) {
    const ids = rows.map((row) => row.id);
    const result = await target.query(
      `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    collisions += Number(result.rows[0].count);
  }
  return collisions;
}

async function inspectRun(source, target, options) {
  if (!options.sourceSlug || !options.targetSlug) {
    throw new Error("Both --source-slug and --target-slug are required");
  }
  const [sourceTenant, targetTenant] = await Promise.all([
    getTenant(source, options.sourceSlug),
    getTenant(target, options.targetSlug),
  ]);
  const [sourceDatabase, targetDatabase] = await Promise.all([
    getDatabaseIdentity(source),
    getDatabaseIdentity(target),
  ]);
  if (
    sourceDatabase.system_identifier === targetDatabase.system_identifier &&
    sourceDatabase.database_name === targetDatabase.database_name
  ) {
    throw new Error("Source and target resolve to the same PostgreSQL database");
  }
  await Promise.all([
    assertElevatedRole(source, "Source"),
    assertElevatedRole(target, "Target"),
    assertTableCompatibility(source, target),
  ]);
  const [sourceVersion, targetVersion] = await Promise.all([
    getMigrationVersion(source),
    getMigrationVersion(target),
  ]);
  if (sourceVersion.count !== targetVersion.count || sourceVersion.latest !== targetVersion.latest) {
    throw new Error("Source and target migration versions differ");
  }
  const foreignKeys = await getForeignKeyColumns(source);
  const insertOrder = orderTablesByDependencies(INSERT_ORDER, foreignKeys);

  const sourceUsers = await getUsers(source, sourceTenant.id);
  const targetUsers = await getUsers(target, targetTenant.id);
  assertAccountBootstrap(sourceUsers, targetUsers, options.adoptSourceIdentity);
  assertCompatiblePasswordHashes(sourceUsers);
  const sourceRoles = await getRoles(source, sourceTenant.id);
  const sourceAssignments = await getUserAssignments(source, sourceTenant.id);
  const userMapping = await mapUsers(sourceUsers, targetUsers);
  const unmappedUserReferences = await findUnmappedUserReferences(
    source,
    sourceTenant.id,
    foreignKeys,
  );

  const tableReport = [];
  let targetDataRows = 0;
  for (const table of TENANT_TABLES) {
    const [sourceCount, targetCount] = await Promise.all([
      countTenantRows(source, table, sourceTenant.id),
      countTenantRows(target, table, targetTenant.id),
    ]);
    tableReport.push({ table, source: sourceCount, target: targetCount });
    targetDataRows += targetCount;
  }
  const [sourceBoundaryCount, targetBoundaryCount] = await Promise.all([
    countGradeBoundaryRows(source, sourceTenant.id),
    countGradeBoundaryRows(target, targetTenant.id),
  ]);
  tableReport.push({
    table: "app.grade_boundaries",
    source: sourceBoundaryCount,
    target: targetBoundaryCount,
  });
  targetDataRows += Number(targetBoundaryCount);

  const collisions = [];
  for (const table of [...TENANT_TABLES, ...RELATED_TABLES]) {
    const count = await getPrimaryKeyCollisions(
      source,
      target,
      table,
      sourceTenant.id,
    );
    if (count > 0) collisions.push({ table, count });
  }

  const targetRoles = await getRoles(target, targetTenant.id);
  const sourceRoleNames = new Set(sourceRoles.map((role) => role.name));
  const unexpectedTargetRoles = targetRoles.filter((role) => !sourceRoleNames.has(role.name));

  const audit = await source.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (
              WHERE actor_id IS NOT NULL AND actor_id NOT IN (
                SELECT id FROM platform.users WHERE tenant_id = $1
              )
            )::int AS unmapped_actors,
            count(*) FILTER (
              WHERE target_id NOT IN (
                SELECT id FROM platform.users WHERE tenant_id = $1
              )
            )::int AS unmapped_targets
     FROM platform.iam_audit_log WHERE tenant_id = $1`,
    [sourceTenant.id],
  );

  const nonStudentReferences = await source.query(
    `SELECT
       (SELECT count(*)::int
        FROM app.inventory_audit_log
        WHERE tenant_id = $1 AND actor_id IS NOT NULL
          AND actor_id NOT IN (
            SELECT id FROM platform.users WHERE tenant_id = $1
          )) AS unmapped_inventory_actors,
       (SELECT count(*)::int
        FROM app.course_offerings co
        LEFT JOIN app.staff_profiles sp
          ON sp.id = co.instructor_id AND sp.tenant_id = $1
        LEFT JOIN platform.users u
          ON u.id = co.instructor_id AND u.tenant_id = $1
        WHERE co.tenant_id = $1 AND co.instructor_id IS NOT NULL
          AND sp.id IS NULL AND u.id IS NULL
       ) AS unmapped_instructors`,
    [sourceTenant.id],
  );

  const { uploads, potentialSecretPaths } = await inspectTenantReferences(source, sourceTenant);
  const excludedCounts = await getExcludedCounts(source, sourceTenant.id);

  return {
    adoptSourceIdentity: options.adoptSourceIdentity,
    sourceTenant,
    targetTenant,
    sourceVersion,
    targetVersion,
    sourceUsers,
    targetUsers,
    sourceRoles,
    sourceAssignments,
    userMapping,
    foreignKeys,
    insertOrder,
    unmappedUserReferences,
    tableReport,
    targetDataRows,
    collisions,
    unexpectedTargetRoles,
    audit: audit.rows[0],
    nonStudentReferences: nonStudentReferences.rows[0],
    uploads,
    potentialSecretPaths,
    excludedCounts,
  };
}

async function getExcludedCounts(client, tenantId) {
  const counts = [];
  for (const table of EXCLUDED_TABLES) {
    const [schema, name] = table.split(".");
    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, name],
    );
    const columnNames = new Set(columns.rows.map((row) => row.column_name));
    if (columnNames.has("tenant_id")) {
      const result = await client.query(
        `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE tenant_id = $1`,
        [tenantId],
      );
      counts.push({ table, count: result.rows[0].count });
      continue;
    }
    if (columnNames.has("user_id")) {
      const result = await client.query(
        `SELECT count(*)::int AS count FROM ${quoteTable(table)} source_records
         JOIN platform.users tenant_users ON tenant_users.id = source_records.user_id
         WHERE tenant_users.tenant_id = $1`,
        [tenantId],
      );
      counts.push({ table, count: result.rows[0].count });
      continue;
    }
    if (columns.rowCount === 0) continue;
    throw new Error(`Cannot scope excluded table count to a tenant: ${table}`);
  }
  return counts;
}

async function inspectTenantReferences(client, tenant) {
  const references = new Set();
  const potentialSecretPaths = new Set();
  for (const table of TENANT_TABLES) {
    for await (const rows of getRowBatches(client, table, tenant.id)) {
      for (const row of rows) {
        findPotentialSecretPaths(row, table, potentialSecretPaths);
        for (const value of Object.values(row)) {
          if (typeof value !== "string") continue;
          for (const match of value.matchAll(UPLOAD_REFERENCE_PATTERN)) {
            references.add(`/uploads/${match[1]}`);
          }
        }
      }
    }
  }
  findPotentialSecretPaths(tenant, "platform.tenants", potentialSecretPaths);
  for (const value of Object.values(tenant)) {
    if (typeof value !== "string") continue;
    for (const match of value.matchAll(UPLOAD_REFERENCE_PATTERN)) {
      references.add(`/uploads/${match[1]}`);
    }
  }
  return {
    uploads: [...references].sort(),
    potentialSecretPaths: [...potentialSecretPaths].sort(),
  };
}

function printReport(report, applyRequested) {
  console.log(`Source tenant: ${report.sourceTenant.name} (${report.sourceTenant.slug})`);
  console.log(`Target tenant: ${report.targetTenant.name} (${report.targetTenant.slug})`);
  console.log(`Database migrations: ${report.sourceVersion.count}, latest ${report.sourceVersion.latest}`);
  console.log(`User accounts: source=${report.sourceUsers.length}, existing target matches=${report.userMapping.map.size}`);
  console.log(`Users requiring a new production account: ${report.sourceUsers.length - report.userMapping.map.size}`);
  console.log(`Tenant roles: ${report.sourceRoles.length}; role assignments: ${report.sourceAssignments.length}`);
  console.log(`IAM audit: ${report.audit.total}; unmapped actors=${report.audit.unmapped_actors}; unmapped targets=${report.audit.unmapped_targets}`);
  console.log(`Additional references: inventory actors unmapped=${report.nonStudentReferences.unmapped_inventory_actors}; instructors unmapped=${report.nonStudentReferences.unmapped_instructors}`);
  console.log(`Unmapped user-reference columns: ${report.unmappedUserReferences.length}`);
  for (const item of report.unmappedUserReferences) {
    console.log(`UNMAPPED_USER_REFERENCE|${item.table}.${item.column}|${item.count}`);
  }
  console.log("\nIncluded-table row counts (source | existing target):");
  for (const row of report.tableReport) {
    console.log(`${row.table}|${row.source}|${row.target}`);
  }
  console.log("\nExplicitly excluded transient/security row counts:");
  for (const row of report.excludedCounts) console.log(`${row.table}|${row.count}`);
  console.log(`\nPotential secret-bearing fields: ${report.potentialSecretPaths.length}`);
  for (const path of report.potentialSecretPaths) console.log(`SECRET_FIELD|${path}`);
  console.log(`\nPrimary-key collisions: ${report.collisions.length}`);
  console.log(`Unexpected target roles: ${report.unexpectedTargetRoles.length}`);
  console.log(`Referenced local uploads: ${report.uploads.length}`);
  console.log(
    applyRequested
      ? "\nPreflight only: apply requested; changes begin only after all safeguards pass."
      : "\nDry-run only: no target records were written.",
  );
}

function assertPathWithin(root, candidate, label) {
  const pathFromRoot = relative(root, candidate);
  if (
    !pathFromRoot ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(`${label} resolves outside its configured directory`);
  }
}

async function hashFile(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

async function prepareReferencedUploads(references, options) {
  if (references.length === 0) {
    return { finalize: async () => {}, rollback: async () => {} };
  }
  if (!options.sourceUploadsDir || !options.targetUploadsDir) {
    throw new Error(
      "Referenced uploads require SOURCE_UPLOADS_DIR and TARGET_UPLOADS_DIR on the migration host",
    );
  }
  const sourceRoot = await realpath(options.sourceUploadsDir);
  const targetRoot = await realpath(options.targetUploadsDir);
  if (!(await stat(sourceRoot)).isDirectory() || !(await stat(targetRoot)).isDirectory()) {
    throw new Error("Configured upload paths must be existing directories");
  }
  const stagingDirectory = await mkdtemp(join(targetRoot, ".amis-tenant-migration-"));
  const stagedFiles = [];
  const installedFiles = [];

  const rollback = async () => {
    for (const path of installedFiles) {
      try {
        await unlink(path);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await rm(stagingDirectory, { recursive: true, force: true });
  };

  try {
    for (const reference of references) {
      const match = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(reference);
      if (!match) throw new Error("An upload reference has an unsupported path format");
      const fileName = match[1];
      const sourcePath = await realpath(join(sourceRoot, fileName));
      assertPathWithin(sourceRoot, sourcePath, "Source upload");
      if (!(await stat(sourcePath)).isFile()) {
        throw new Error("A referenced upload is not a regular file");
      }
      const targetPath = join(targetRoot, fileName);
      try {
        await lstat(targetPath);
        throw new Error("A referenced upload already exists in the target directory");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const stagedPath = join(stagingDirectory, fileName);
      await copyFile(sourcePath, stagedPath, fsConstants.COPYFILE_EXCL);
      const [sourceHash, stagedHash] = await Promise.all([
        hashFile(sourcePath),
        hashFile(stagedPath),
      ]);
      if (sourceHash !== stagedHash) {
        throw new Error("A referenced upload failed its SHA-256 copy verification");
      }
      stagedFiles.push({ stagedPath, targetPath });
    }
  } catch (error) {
    await rollback();
    throw error;
  }

  return {
    finalize: async () => {
      try {
        for (const file of stagedFiles) {
          await copyFile(file.stagedPath, file.targetPath, fsConstants.COPYFILE_EXCL);
          installedFiles.push(file.targetPath);
        }
        await rm(stagingDirectory, { recursive: true, force: true });
      } catch (error) {
        await rollback();
        throw error;
      }
    },
    rollback,
  };
}

async function insertRows(
  client,
  table,
  rows,
  targetTenantId,
  userMap,
  foreignKeys,
  deferRollbackLink = false,
) {
  if (rows.length === 0) return;
  const columns = await getColumns(client, table);
  const insertable = columns
    .filter((column) => column.is_generated === "NEVER")
    .map((column) => column.column_name);
  const targetColumns = insertable.map(quoteIdentifier).join(", ");
  const tableName = quoteTable(table);
  const userReferenceColumns = getUserReferenceColumns(table, foreignKeys);
  const selfReferenceColumns = foreignKeys.filter(
    (foreignKey) =>
      foreignKey.child_table === table && foreignKey.parent_table === table,
  );
  const deferredReferences = [];
  for (const row of rows) {
    if (Object.hasOwn(row, "tenant_id")) row.tenant_id = targetTenantId;
    for (const column of userReferenceColumns) {
      if (row[column] !== null && row[column] !== undefined) {
        const mapped = userMap.get(row[column]);
        if (!mapped) throw new Error(`No target account mapping for ${table}.${column}`);
        row[column] = mapped;
      }
    }
    if (
      table === "app.course_offerings" &&
      row.instructor_id &&
      userMap.has(row.instructor_id)
    ) {
      row.instructor_id = userMap.get(row.instructor_id);
    }
    for (const foreignKey of selfReferenceColumns) {
      const value = row[foreignKey.child_column];
      if (value === null || value === undefined) continue;
      if (!foreignKey.child_nullable) {
        throw new Error(`Non-null self-reference is not supported for ${table}.${foreignKey.child_column}`);
      }
      deferredReferences.push({
        id: row.id,
        column: foreignKey.child_column,
        value,
      });
      row[foreignKey.child_column] = null;
    }
  }
  const values = [];
  const valueGroups = rows.map((row) => {
    const placeholders = insertable.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  await client.query(
    `INSERT INTO ${tableName} (${targetColumns}) VALUES ${valueGroups.join(", ")}`,
    values,
  );
  return deferredReferences;
}

async function restoreSelfReferences(target, table, tenantId, references) {
  for (const reference of references) {
    const tenantPredicate = TENANT_TABLES.includes(table) ? " AND tenant_id = $3" : "";
    const values = [reference.value, reference.id];
    if (tenantPredicate) values.push(tenantId);
    await target.query(
      `UPDATE ${quoteTable(table)}
       SET ${quoteIdentifier(reference.column)} = $1
       WHERE id = $2${tenantPredicate}`,
      values,
    );
  }
}

async function transferUsers(source, target, sourceTenantId, targetTenantId, sourceUsers, targetUsers) {
  const { map } = await mapUsers(sourceUsers, targetUsers);
  const sourceById = new Map(sourceUsers.map((user) => [user.id, user]));
  for (const sourceUser of sourceUsers) {
    const existingId = map.get(sourceUser.id);
    if (existingId) {
      await target.query(
        `UPDATE platform.users
         SET role = $1, first_name = $2, last_name = $3, department = $4,
             is_active = $5, password_hash = $6
         WHERE id = $7 AND tenant_id = $8`,
        [
          sourceUser.role,
          sourceUser.first_name,
          sourceUser.last_name,
          sourceUser.department,
          sourceUser.is_active,
          sourceUser.password_hash,
          existingId,
          targetTenantId,
        ],
      );
      continue;
    }
    const profile = USER_SAFE_COLUMNS.filter((column) => column !== "email" && column !== "created_at");
    const columns = ["tenant_id", "email", "password_hash", ...profile, "created_at"];
    const values = [
      targetTenantId,
      sourceUser.email,
      sourceUser.password_hash,
      ...profile.map((column) => sourceUser[column]),
      sourceUser.created_at,
    ];
    const result = await target.query(
      `INSERT INTO platform.users (${columns.map(quoteIdentifier).join(", ")})
       VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
       RETURNING id`,
      values,
    );
    map.set(sourceUser.id, result.rows[0].id);
  }
  if (sourceById.size !== map.size) throw new Error("Not all source users were mapped to production accounts");
  return map;
}

async function transferRoles(source, target, sourceTenantId, targetTenantId, userMap) {
  const roles = await getRoles(source, sourceTenantId);
  const roleMap = new Map();
  for (const role of roles) {
    const result = await target.query(
      `INSERT INTO platform.roles (tenant_id, name)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [targetTenantId, role.name],
    );
    roleMap.set(role.id, result.rows[0].id);
  }
  const sourceUsers = await getUsers(source, sourceTenantId);
  const sourceUserIds = sourceUsers.map((user) => user.id);
  const assignmentResult = await source.query(
    `SELECT user_id, role_id FROM platform.user_roles WHERE user_id = ANY($1::uuid[])`,
    [sourceUserIds],
  );
  for (const assignment of assignmentResult.rows) {
    const mappedUser = userMap.get(assignment.user_id);
    const mappedRole = roleMap.get(assignment.role_id);
    if (!mappedUser || !mappedRole) throw new Error("Unable to map a source user-role assignment");
    await target.query(
      `INSERT INTO platform.user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [mappedUser, mappedRole],
    );
  }
}

async function transferTable(source, target, table, sourceTenantId, targetTenantId, userMap, foreignKeys) {
  let count = 0;
  const deferredReferences = [];
  for await (const rows of getRowBatches(source, table, sourceTenantId)) {
    deferredReferences.push(
      ...await insertRows(target, table, rows, targetTenantId, userMap, foreignKeys),
    );
    count += rows.length;
  }
  await restoreSelfReferences(target, table, targetTenantId, deferredReferences);
  return count;
}

async function transferConfigVersions(
  source,
  target,
  sourceTenantId,
  targetTenantId,
  userMap,
  foreignKeys,
) {
  const deferredReferences = [];
  let count = 0;
  for await (const rows of getRowBatches(source, "platform.config_versions", sourceTenantId)) {
    deferredReferences.push(
      ...await insertRows(
        target,
        "platform.config_versions",
        rows,
        targetTenantId,
        userMap,
        foreignKeys,
      ),
    );
    count += rows.length;
  }
  await restoreSelfReferences(
    target,
    "platform.config_versions",
    targetTenantId,
    deferredReferences,
  );
  return count;
}

async function checkDestinationEmpty(target, report) {
  if (report.targetDataRows > 0) throw new Error("Target tenant already contains data in the migration allowlist");
  if (report.unexpectedTargetRoles.length > 0) throw new Error("Target tenant has roles not found in the source");
  if (report.collisions.length > 0) throw new Error("Primary-key collisions found; refusing to import");
  if (Number(report.audit.unmapped_actors) > 0 || Number(report.audit.unmapped_targets) > 0) {
    throw new Error("IAM audit contains user references that cannot be mapped");
  }
  if (
    Number(report.nonStudentReferences.unmapped_inventory_actors) > 0 ||
    Number(report.nonStudentReferences.unmapped_instructors) > 0
  ) {
    throw new Error("Unmapped inventory actor or course instructor references found");
  }
  if (report.unmappedUserReferences.length > 0) {
    throw new Error("User references do not map to users in the source tenant");
  }
  if (report.targetUsers.length !== report.userMapping.map.size) {
    throw new Error("Every existing destination user must match a source user by email");
  }
  if (report.sourceUsers.length === 0) {
    throw new Error("Source tenant has no user accounts to bootstrap the destination");
  }
  if (report.targetUsers.length === 0 && !report.adoptSourceIdentity) {
    throw new Error("Provision the target tenant and its initial admin first");
  }
}

async function applyMigration(source, target, report, options) {
  if (!options.confirmSourcePaused || !options.confirmProductionWrite) {
    throw new Error("Apply requires --confirm-source-paused and --confirm-production-write");
  }
  if (!options.approvalReference || !options.backupReference) {
    throw new Error("Apply requires --approval-reference and --backup-reference");
  }
  if (report.potentialSecretPaths.length > 0 && !options.confirmSecretsReviewed) {
    throw new Error("Apply with potential secret-bearing fields requires --confirm-secrets-reviewed");
  }
  await checkDestinationEmpty(target, report);

  const sourceTenantId = report.sourceTenant.id;
  const targetTenantId = report.targetTenant.id;
  let stagedUploads;
  let commitAttempted = false;
  let committed = false;
  await target.query("BEGIN");
  try {
    await target.query(
      `SELECT id FROM platform.tenants WHERE id = $1 FOR UPDATE`,
      [targetTenantId],
    );
    report = await inspectRun(source, target, options);
    await checkDestinationEmpty(target, report);
    if (report.potentialSecretPaths.length > 0 && !options.confirmSecretsReviewed) {
      throw new Error("Apply with potential secret-bearing fields requires --confirm-secrets-reviewed");
    }
    stagedUploads = await prepareReferencedUploads(report.uploads, options);
    await updateTenantSetup(
      target,
      report.sourceTenant,
      targetTenantId,
      options.adoptSourceIdentity,
    );
    const currentUsers = await getUsers(target, targetTenantId);
    const userMap = await transferUsers(
      source,
      target,
      sourceTenantId,
      targetTenantId,
      report.sourceUsers,
      currentUsers,
    );
    await transferRoles(source, target, sourceTenantId, targetTenantId, userMap);

    const copied = new Map();
    for (const table of report.insertOrder) {
      if (table === "platform.config_versions") {
        copied.set(table, await transferConfigVersions(
          source,
          target,
          sourceTenantId,
          targetTenantId,
          userMap,
          report.foreignKeys,
        ));
      } else {
        copied.set(table, await transferTable(
          source,
          target,
          table,
          sourceTenantId,
          targetTenantId,
          userMap,
          report.foreignKeys,
        ));
      }
    }

    async function updateTenantSetup(client, sourceTenant, targetTenantId, adoptSourceIdentity) {
      const columns = adoptSourceIdentity
        ? TENANT_SETUP_COLUMNS
        : TENANT_SETUP_COLUMNS.filter((column) => column !== "slug");
      const assignments = columns.map((column, index) =>
        `${quoteIdentifier(column)} = $${index + 1}`,
      );
      const values = columns.map((column) => sourceTenant[column]);
      values.push(targetTenantId);
      await client.query(
        `UPDATE platform.tenants SET ${assignments.join(", ")} WHERE id = $${values.length}`,
        values,
      );
    }

    const sourceItems = await source.query(
      `SELECT id, current_stock FROM app.inventory_items WHERE tenant_id = $1`,
      [sourceTenantId],
    );
    for (const item of sourceItems.rows) {
      await target.query(
        `UPDATE app.inventory_items SET current_stock = $1 WHERE id = $2 AND tenant_id = $3`,
        [item.current_stock, item.id, targetTenantId],
      );
    }

    await verifyImportedCounts(target, targetTenantId, report, copied);
    await stagedUploads.finalize();
    commitAttempted = true;
    await target.query("COMMIT");
    committed = true;
    console.log("\nMigration committed successfully.");
    console.log(`Approval reference: ${options.approvalReference}`);
    console.log(`Backup reference: ${options.backupReference}`);
    for (const [table, count] of copied) console.log(`COPIED|${table}|${count}`);
  } catch (error) {
    if (!commitAttempted) {
      await target.query("ROLLBACK");
      if (stagedUploads) await stagedUploads.rollback();
    } else if (!committed) {
      console.error("Database commit outcome is uncertain; retained copied uploads for reconciliation.");
    }
    throw error;
  }
}

async function verifyImportedCounts(target, targetTenantId, report, copied) {
  for (const item of report.tableReport) {
    const actual = item.table === "app.grade_boundaries"
      ? await countGradeBoundaryRows(target, targetTenantId)
      : await countTenantRows(target, item.table, targetTenantId);
    if (Number(actual) !== Number(item.source)) {
      throw new Error(`Post-import count mismatch for ${item.table}: expected ${item.source}, got ${actual}`);
    }
  }
  const userCount = await target.query(
    `SELECT count(*)::int AS count FROM platform.users WHERE tenant_id = $1`,
    [targetTenantId],
  );
  if (Number(userCount.rows[0].count) !== report.sourceUsers.length) {
    throw new Error("Post-import user count mismatch");
  }
  const roleCount = await target.query(
    `SELECT count(*)::int AS count FROM platform.user_roles ur
     JOIN platform.users u ON u.id = ur.user_id WHERE u.tenant_id = $1`,
    [targetTenantId],
  );
  if (Number(roleCount.rows[0].count) !== report.sourceAssignments.length) {
    throw new Error("Post-import user-role assignment count mismatch");
  }
  if (copied.get("platform.iam_audit_log") !== Number(report.audit.total)) {
    throw new Error("Post-import IAM audit count mismatch");
  }
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArgs(argv);
  options.sourceUploadsDir = environment.SOURCE_UPLOADS_DIR ?? "";
  options.targetUploadsDir = environment.TARGET_UPLOADS_DIR ?? "";
  const sourceUrl = environment.SOURCE_DATABASE_URL;
  const targetUrl = environment.TARGET_DATABASE_URL ?? environment.DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL (or DATABASE_URL) without printing them");
  }
  if (sourceUrl === targetUrl) throw new Error("Source and target database URLs must differ");

  const Client = getPgClient();
  const source = new Client({ connectionString: sourceUrl, application_name: "amis-tenant-migration-source" });
  const target = new Client({ connectionString: targetUrl, application_name: "amis-tenant-migration-target" });
  try {
    await source.connect();
    await target.connect();
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const report = await inspectRun(source, target, options);
    printReport(report, options.apply);
    if (options.uploadManifestPath) {
      await writeFile(
        options.uploadManifestPath,
        report.uploads.map((upload) => `${upload}\n`).join(""),
        { mode: 0o600 },
      );
    }
    if (options.apply) await applyMigration(source, target, report, options);
    else await source.query("ROLLBACK");
  } finally {
    await source.end();
    await target.end();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  main().catch((error) => {
    console.error(`Tenant migration stopped: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  EXCLUDED_TABLES,
  INSERT_ORDER,
  TENANT_TABLES,
  assertAccountBootstrap,
  findPotentialSecretPaths,
  isCompatiblePasswordHash,
  main as runMigration,
  newPasswordHash,
  mapUsers,
  normalizeEmail,
  orderTablesByDependencies,
  parseArgs,
  prepareReferencedUploads,
  quoteTable,
};
