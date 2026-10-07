#!/usr/bin/env node

import { createRequire } from "node:module";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
];

const RELATED_TABLES = ["app.grade_boundaries"];

const EXCLUDED_TABLES = [
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
  "ownership_type",
  "uvtab_centre_code",
  "license_number",
  "license_date",
  "license_status",
  "setup_completed",
  "setup_completed_at",
];

function parseArgs(argv) {
  const options = {
    apply: false,
    sourceSlug: "",
    targetSlug: "",
    approvalReference: "",
    backupReference: "",
    confirmSourcePaused: false,
    confirmProductionWrite: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--confirm-source-paused") options.confirmSourcePaused = true;
    else if (arg === "--confirm-production-write") options.confirmProductionWrite = true;
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
}

async function countTenantRows(client, table, tenantId) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0].count;
}

async function getRows(client, table, tenantId) {
  return client.query(
    `SELECT * FROM ${quoteTable(table)} WHERE tenant_id = $1 ORDER BY id`,
    [tenantId],
  ).then((result) => result.rows);
}

async function getGradeBoundaryRows(client, tenantId) {
  const result = await client.query(
    `SELECT gb.*
     FROM app.grade_boundaries gb
     JOIN app.grading_scales gs ON gs.id = gb.grading_scale_id
     WHERE gs.tenant_id = $1
     ORDER BY gb.id`,
    [tenantId],
  );
  return result.rows;
}

async function getUsers(client, tenantId) {
  return client.query(
    `SELECT ${USER_SAFE_COLUMNS.map(quoteIdentifier).join(", ")}, id
     FROM platform.users WHERE tenant_id = $1 ORDER BY lower(email), id`,
    [tenantId],
  ).then((result) => result.rows);
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

async function getPrimaryKeyCollisions(source, target, table, sourceTenantId, targetTenantId) {
  const sourceRows = table === "app.grade_boundaries"
    ? await getGradeBoundaryRows(source, sourceTenantId)
    : await getRows(source, table, sourceTenantId);
  if (sourceRows.length === 0) return { sourceRows, collisions: 0 };
  const ids = sourceRows.map((row) => row.id);
  const result = await target.query(
    `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return { sourceRows, collisions: result.rows[0].count };
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

  const [sourceUsers, targetUsers, sourceRoles, sourceAssignments] = await Promise.all([
    getUsers(source, sourceTenant.id),
    getUsers(target, targetTenant.id),
    getRoles(source, sourceTenant.id),
    getUserAssignments(source, sourceTenant.id),
  ]);
  const userMapping = await mapUsers(sourceUsers, targetUsers);

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
  const [sourceBoundaryRows, targetBoundaryRows] = await Promise.all([
    getGradeBoundaryRows(source, sourceTenant.id),
    getGradeBoundaryRows(target, targetTenant.id),
  ]);
  tableReport.push({
    table: "app.grade_boundaries",
    source: sourceBoundaryRows.length,
    target: targetBoundaryRows.length,
  });
  targetDataRows += targetBoundaryRows.length;

  const collisions = [];
  for (const table of [...TENANT_TABLES, ...RELATED_TABLES]) {
    const result = await getPrimaryKeyCollisions(
      source,
      target,
      table,
      sourceTenant.id,
      targetTenant.id,
    );
    if (result.collisions > 0) collisions.push({ table, count: result.collisions });
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

  const uploads = await findUploadReferences(source, sourceTenant.id);
  const excludedCounts = await getExcludedCounts(source, sourceTenant.id);

  return {
    sourceTenant,
    targetTenant,
    sourceVersion,
    targetVersion,
    sourceUsers,
    targetUsers,
    sourceRoles,
    sourceAssignments,
    userMapping,
    tableReport,
    targetDataRows,
    collisions,
    unexpectedTargetRoles,
    audit: audit.rows[0],
    nonStudentReferences: nonStudentReferences.rows[0],
    uploads,
    excludedCounts,
  };
}

async function getExcludedCounts(client, tenantId) {
  const counts = [];
  for (const table of EXCLUDED_TABLES) {
    const [schema, name] = table.split(".");
    const exists = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = 'tenant_id'`,
      [schema, name],
    );
    if (exists.rowCount === 0) continue;
    const result = await client.query(
      `SELECT count(*)::int AS count FROM ${quoteTable(table)} WHERE tenant_id = $1`,
      [tenantId],
    );
    counts.push({ table, count: result.rows[0].count });
  }
  return counts;
}

async function findUploadReferences(client, tenantId) {
  const references = new Set();
  const pattern = /\/uploads\/[A-Za-z0-9._-]+/g;
  for (const table of TENANT_TABLES) {
    const rows = await getRows(client, table, tenantId);
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value !== "string") continue;
        for (const match of value.matchAll(pattern)) references.add(match[0]);
      }
    }
  }
  const tenant = await client.query(
    `SELECT logo_url FROM platform.tenants WHERE id = $1`,
    [tenantId],
  );
  for (const value of Object.values(tenant.rows[0] ?? {})) {
    if (typeof value !== "string") continue;
    for (const match of value.matchAll(pattern)) references.add(match[0]);
  }
  return [...references].sort();
}

function printReport(report, applyRequested) {
  console.log(`Source tenant: ${report.sourceTenant.name} (${report.sourceTenant.slug})`);
  console.log(`Target tenant: ${report.targetTenant.name} (${report.targetTenant.slug})`);
  console.log(`Database migrations: ${report.sourceVersion.count}, latest ${report.sourceVersion.latest}`);
  console.log(`User accounts: source=${report.sourceUsers.length}, existing target matches=${report.userMapping.map.size}`);
  console.log(`Users requiring a new production account: ${report.sourceUsers.length - report.userMapping.map.size}`);
  console.log(`Tenant roles: ${report.sourceRoles.length}; role assignments: ${report.sourceAssignments.length}`);
  console.log(`IAM audit: ${report.audit.total}; unmapped actors=${report.audit.unmapped_actors}; unmapped targets=${report.audit.unmapped_targets}`);
  console.log(`Non-student user references: inventory actors unmapped=${report.nonStudentReferences.unmapped_inventory_actors}; instructors unmapped=${report.nonStudentReferences.unmapped_instructors}`);
  console.log("\nIncluded-table row counts (source | existing target):");
  for (const row of report.tableReport) {
    console.log(`${row.table}|${row.source}|${row.target}`);
  }
  console.log("\nExplicitly excluded student/runtime row counts:");
  for (const row of report.excludedCounts) console.log(`${row.table}|${row.count}`);
  console.log(`\nPrimary-key collisions: ${report.collisions.length}`);
  console.log(`Unexpected target roles: ${report.unexpectedTargetRoles.length}`);
  console.log(`Referenced local uploads: ${report.uploads.length}`);
  if (report.uploads.length > 0) {
    for (const upload of report.uploads) console.log(`UPLOAD|${upload}`);
  }
  console.log(
    applyRequested
      ? "\nPreflight only: apply requested; changes begin only after all safeguards pass."
      : "\nDry-run only: no target records were written.",
  );
}

async function insertRows(client, table, rows, targetTenantId, userMap, deferRollbackLink = false) {
  if (rows.length === 0) return;
  const columns = await getColumns(client, table);
  const insertable = columns
    .filter((column) => column.is_generated === "NEVER")
    .map((column) => column.column_name);
  const targetColumns = insertable.map(quoteIdentifier).join(", ");
  const tableName = quoteTable(table);
  const batchSize = 100;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    for (const row of batch) {
      if (Object.hasOwn(row, "tenant_id")) row.tenant_id = targetTenantId;
      if (table === "platform.iam_audit_log" || table === "app.inventory_audit_log") {
        for (const column of ["actor_id", "target_id"]) {
          if (row[column] !== null && row[column] !== undefined) {
            const mapped = userMap.get(row[column]);
            if (!mapped) throw new Error(`No target account mapping for ${table}.${column}`);
            row[column] = mapped;
          }
        }
      }
      if (
        table === "app.course_offerings" &&
        row.instructor_id &&
        userMap.has(row.instructor_id)
      ) {
        row.instructor_id = userMap.get(row.instructor_id);
      }
      if (deferRollbackLink && table === "platform.config_versions") row.rollback_of = null;
      const values = insertable.map((column) => row[column]);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await client.query(
        `INSERT INTO ${tableName} (${targetColumns}) VALUES (${placeholders})`,
        values,
      );
    }
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
         SET role = $1, first_name = $2, last_name = $3, department = $4, is_active = $5
         WHERE id = $6 AND tenant_id = $7`,
        [
          sourceUser.role,
          sourceUser.first_name,
          sourceUser.last_name,
          sourceUser.department,
          sourceUser.is_active,
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
      newPasswordHash(),
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

async function transferTable(source, target, table, sourceTenantId, targetTenantId, userMap) {
  const rows = table === "app.grade_boundaries"
    ? await getGradeBoundaryRows(source, sourceTenantId)
    : await getRows(source, table, sourceTenantId);
  await insertRows(target, table, rows, targetTenantId, userMap);
  return rows.length;
}

async function transferConfigVersions(source, target, sourceTenantId, targetTenantId, userMap) {
  const rows = await getRows(source, "platform.config_versions", sourceTenantId);
  await insertRows(target, "platform.config_versions", rows, targetTenantId, userMap, true);
  for (const row of rows) {
    if (row.rollback_of) {
      await target.query(
        `UPDATE platform.config_versions SET rollback_of = $1 WHERE id = $2 AND tenant_id = $3`,
        [row.rollback_of, row.id, targetTenantId],
      );
    }
  }
  return rows.length;
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
  if (report.uploads.length > 0) {
    throw new Error("Referenced /uploads files need a separately reviewed transfer before database import");
  }
  if (report.targetUsers.length !== report.userMapping.map.size) {
    throw new Error("Every existing destination user must match a source user by email");
  }
  if (report.targetUsers.length === 0) throw new Error("Provision the target tenant and its initial admin first");
}

async function applyMigration(source, target, report, options) {
  if (!options.confirmSourcePaused || !options.confirmProductionWrite) {
    throw new Error("Apply requires --confirm-source-paused and --confirm-production-write");
  }
  if (!options.approvalReference || !options.backupReference) {
    throw new Error("Apply requires --approval-reference and --backup-reference");
  }
  await checkDestinationEmpty(target, report);

  const sourceTenantId = report.sourceTenant.id;
  const targetTenantId = report.targetTenant.id;
  await target.query("BEGIN");
  try {
    await target.query(
      `SELECT id FROM platform.tenants WHERE id = $1 FOR UPDATE`,
      [targetTenantId],
    );
    report = await inspectRun(source, target, options);
    await checkDestinationEmpty(target, report);
    await updateTenantSetup(target, report.sourceTenant, targetTenantId);
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
    for (const table of INSERT_ORDER) {
      if (table === "platform.config_versions") {
        copied.set(table, await transferConfigVersions(
          source,
          target,
          sourceTenantId,
          targetTenantId,
          userMap,
        ));
      } else {
        copied.set(table, await transferTable(
          source,
          target,
          table,
          sourceTenantId,
          targetTenantId,
          userMap,
        ));
      }
    }

    async function updateTenantSetup(client, sourceTenant, targetTenantId) {
      const assignments = TENANT_SETUP_COLUMNS.map((column, index) =>
        `${quoteIdentifier(column)} = $${index + 1}`,
      );
      const values = TENANT_SETUP_COLUMNS.map((column) => sourceTenant[column]);
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
    await target.query("COMMIT");
    console.log("\nMigration committed successfully.");
    console.log(`Approval reference: ${options.approvalReference}`);
    console.log(`Backup reference: ${options.backupReference}`);
    for (const [table, count] of copied) console.log(`COPIED|${table}|${count}`);
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  }
}

async function verifyImportedCounts(target, targetTenantId, report, copied) {
  for (const item of report.tableReport) {
    const actual = item.table === "app.grade_boundaries"
      ? (await getGradeBoundaryRows(target, targetTenantId)).length
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL without printing them");
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
  newPasswordHash,
  mapUsers,
  normalizeEmail,
  parseArgs,
  quoteTable,
};
