/**
 * Seed two dev tenants with students + users.
 * Run from repo root:
 *   $env:DATABASE_URL="postgres://postgres:password123@localhost:5432/amis_multi_tenant?sslmode=disable"
 *   apps\api\node_modules\.bin\tsx.cmd db/seeds/seed.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { hashPassword } from "../../apps/api/src/lib/password.js";

// Load .env from repo root when DATABASE_URL is not already set
try {
  const envPath = resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not found — rely on DATABASE_URL already being set in environment
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function withTenant<T>(
  client: pg.PoolClient,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [
    tenantId,
  ]);
  const result = await fn();
  await client.query("COMMIT");
  return result;
}

async function seed() {
  const client = await pool.connect();
  try {
    // Upsert tenants (idempotent)
    const tenantA = await client.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('greenfield-vti', 'Greenfield VTI')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const tenantB = await client.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, name)
       VALUES ('riverside-tech', 'Riverside Tech College')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );

    const idA = tenantA.rows[0].id;
    const idB = tenantB.rows[0].id;

    console.log(`Tenant A (Greenfield VTI):        ${idA}`);
    console.log(`Tenant B (Riverside Tech College): ${idB}`);

    // Seed students for Tenant A
    await withTenant(client, idA, async () => {
      await client.query(
        `INSERT INTO app.students (tenant_id, first_name, last_name, date_of_birth)
         VALUES ($1, 'Alice', 'Mokoena', '2004-03-12'),
                ($1, 'Brian', 'Dlamini', '2003-07-22'),
                ($1, 'Carol', 'Nkosi',   '2005-01-08')
         ON CONFLICT DO NOTHING`,
        [idA],
      );
      console.log("Seeded 3 students for Tenant A");
    });

    // Seed students for Tenant B
    await withTenant(client, idB, async () => {
      await client.query(
        `INSERT INTO app.students (tenant_id, first_name, last_name, date_of_birth)
         VALUES ($1, 'David', 'Osei',    '2004-11-05'),
                ($1, 'Eva',   'Mensah',  '2003-09-14')
         ON CONFLICT DO NOTHING`,
        [idB],
      );
      console.log("Seeded 2 students for Tenant B");
    });

    // Seed programmes for Tenant A (Greenfield VTI)
    await withTenant(client, idA, async () => {
      await client.query(
        `INSERT INTO app.programmes (tenant_id, code, title, department, duration_months, level, is_active)
         VALUES
           ($1, 'NCBC',  'National Certificate in Business Computing',    'Business & ICT',     12, 'National Certificate', true),
           ($1, 'NCES',  'National Certificate in Electrical Systems',    'Engineering',        24, 'National Certificate', true),
           ($1, 'NCAM',  'National Certificate in Automotive Mechanics',  'Engineering',        24, 'National Certificate', true),
           ($1, 'NCP',   'National Certificate in Plumbing',              'Built Environment',  24, 'National Certificate', true),
           ($1, 'NCWF',  'National Certificate in Welding & Fabrication', 'Engineering',        18, 'National Certificate', true),
           ($1, 'NCCA',  'National Certificate in Civil & Construction',  'Built Environment',  24, 'National Certificate', true),
           ($1, 'NCHM',  'National Certificate in Hospitality Mgmt',      'Hospitality',        12, 'National Certificate', true)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [idA],
      );
      console.log("Seeded 7 programmes for Tenant A");
    });

    // Seed programmes for Tenant B (Riverside Tech College)
    await withTenant(client, idB, async () => {
      await client.query(
        `INSERT INTO app.programmes (tenant_id, code, title, department, duration_months, level, is_active)
         VALUES
           ($1, 'ND-IT',   'National Diploma in Information Technology', 'ICT',         36, 'National Diploma', true),
           ($1, 'ND-EE',   'National Diploma in Electrical Engineering', 'Engineering', 36, 'National Diploma', true),
           ($1, 'ND-MM',   'National Diploma in Mechanical Manufacturing','Engineering',36, 'National Diploma', true),
           ($1, 'CERT-CS', 'Certificate in Computer Science',            'ICT',         12, 'Certificate',      true),
           ($1, 'CERT-NET','Certificate in Networking & Cybersecurity',  'ICT',         12, 'Certificate',      true)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [idB],
      );
      console.log("Seeded 5 programmes for Tenant B");
    });

    // Seed staff for Tenant A (Greenfield VTI)
    await withTenant(client, idA, async () => {
      await client.query(
        `INSERT INTO app.staff_profiles
           (tenant_id, staff_number, first_name, last_name, email, department, designation, employment_type, join_date, salary)
         VALUES
           ($1, 'STF001', 'Jane',    'Ndlovu',   'jane.ndlovu@greenfield.ac.za',    'ICT',          'Lecturer',          'full_time', '2022-01-10', 35000),
           ($1, 'STF002', 'Peter',   'Sithole',  'peter.sithole@greenfield.ac.za',  'Engineering',  'Senior Lecturer',   'full_time', '2020-03-01', 42000),
           ($1, 'STF003', 'Sarah',   'Mahlangu', 'sarah.mahlangu@greenfield.ac.za', 'Hospitality',  'Lecturer',          'part_time', '2023-07-15', 18000),
           ($1, 'STF004', 'Moses',   'Khumalo',  'moses.khumalo@greenfield.ac.za',  'ICT',          'Lab Technician',    'contract',  '2024-02-01', 22000)
         ON CONFLICT DO NOTHING`,
        [idA],
      );
      console.log("Seeded 4 staff for Tenant A");
    });

    // Seed staff for Tenant B (Riverside Tech College)
    await withTenant(client, idB, async () => {
      await client.query(
        `INSERT INTO app.staff_profiles
           (tenant_id, staff_number, first_name, last_name, email, department, designation, employment_type, join_date, salary)
         VALUES
           ($1, 'STF001', 'Michael', 'Asante',  'michael.asante@riverside.ac.za',  'ICT',         'HOD',               'full_time', '2019-09-01', 55000),
           ($1, 'STF002', 'Grace',   'Mensah',  'grace.mensah@riverside.ac.za',    'Engineering', 'Lecturer',          'full_time', '2021-04-12', 38000),
           ($1, 'STF003', 'Eric',    'Boateng', 'eric.boateng@riverside.ac.za',    'ICT',         'Visiting Lecturer', 'temporary', '2025-01-15', 15000)
         ON CONFLICT DO NOTHING`,
        [idB],
      );
      console.log("Seeded 3 staff for Tenant B");
    });

    // Seed published UI config for Tenant A
    await withTenant(client, idA, async () => {
      await client.query(
        `DELETE FROM platform.config_audit
           WHERE config_id IN (
             SELECT id FROM platform.config_versions
             WHERE tenant_id = $1 AND status = 'published'
           )`,
        [idA],
      );
      await client.query(
        `DELETE FROM platform.config_versions WHERE tenant_id = $1 AND status = 'published'`,
        [idA],
      );
      await client.query(
        `INSERT INTO platform.config_versions (tenant_id, status, payload, published_at, published_by)
         VALUES ($1, 'published', $2::jsonb, now(), 'seed')`,
        [
          idA,
          JSON.stringify({
            modules: { students: true, admissions: true, finance: false },
            branding: { appName: "Greenfield VTI" },
            theme: { primaryColor: "#2563EB" },
            navigation: {
              admin: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Finance", route: "/finance" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Staff", route: "/staff" },
                { label: "Reports", route: "/reports/it" },
                { label: "Users", route: "/users" },
              ],
              registrar: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
              instructor: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Marks", route: "/marks" },
                { label: "Reports", route: "/reports/it" },
              ],
              finance: [
                { label: "Dashboard", route: "/" },
                { label: "Finance", route: "/finance" },
              ],
              hod: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Programmes", route: "/programmes" },
                { label: "Marks", route: "/marks" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
              principal: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Finance", route: "/finance" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
            },
            dashboards: {
              admin: [
                {
                  type: "KPI",
                  label: "Total Students",
                  metricKey: "total_students",
                },
                {
                  type: "ACTION",
                  label: "Enroll Student",
                  route: "/students/new",
                },
              ],
              registrar: [
                {
                  type: "KPI",
                  label: "Total Students",
                  metricKey: "total_students",
                },
                {
                  type: "ACTION",
                  label: "Enroll Student",
                  route: "/students/new",
                },
              ],
              instructor: [
                { type: "KPI", label: "My Students", metricKey: "my_students" },
              ],
              finance: [
                {
                  type: "KPI",
                  label: "Pending Payments",
                  metricKey: "pending_payments",
                },
              ],
              hod: [
                {
                  type: "KPI",
                  label: "Department Students",
                  metricKey: "dept_students",
                },
              ],
              principal: [
                {
                  type: "KPI",
                  label: "Total Students",
                  metricKey: "total_students",
                },
                {
                  type: "KPI",
                  label: "Enrolled This Month",
                  metricKey: "enrolled_this_month",
                },
              ],
            },
            forms: {
              students: {
                fields: [
                  {
                    key: "first_name",
                    label: "First Name",
                    type: "text",
                    visible: true,
                    order: 1,
                  },
                  {
                    key: "last_name",
                    label: "Last Name",
                    type: "text",
                    visible: true,
                    order: 2,
                  },
                  {
                    key: "date_of_birth",
                    label: "Date of Birth",
                    type: "date",
                    visible: true,
                    order: 3,
                  },
                ],
                extensionFields: [],
              },
            },
            workflows: {
              admissions: {
                key: "admissions",
                initial_state: "submitted",
                states: [
                  "submitted",
                  "shortlisted",
                  "interview",
                  "accepted",
                  "rejected",
                ],
                transitions: [
                  { action: "shortlist", from: "submitted", to: "shortlisted" },
                  { action: "interview", from: "shortlisted", to: "interview" },
                  { action: "accept", from: "interview", to: "accepted" },
                  { action: "reject", from: "interview", to: "rejected" },
                ],
              },
              marks: {
                key: "marks",
                initial_state: "DRAFT",
                states: [
                  "DRAFT",
                  "SUBMITTED",
                  "HOD_REVIEW",
                  "APPROVED",
                  "PUBLISHED",
                ],
                transitions: [
                  { action: "submit", from: "DRAFT", to: "SUBMITTED" },
                  { action: "review", from: "SUBMITTED", to: "HOD_REVIEW" },
                  { action: "approve", from: "HOD_REVIEW", to: "APPROVED" },
                  { action: "return", from: "HOD_REVIEW", to: "DRAFT" },
                  { action: "publish", from: "APPROVED", to: "PUBLISHED" },
                ],
              },
              term_registration: {
                key: "term_registration",
                initial_state: "REGISTRATION_STARTED",
                states: [
                  "REGISTRATION_STARTED",
                  "FEE_PAID",
                  "CLEARED",
                  "COMPLETED",
                ],
                transitions: [
                  { action: "pay_fees", from: "REGISTRATION_STARTED", to: "FEE_PAID" },
                  { action: "clear", from: "FEE_PAID", to: "CLEARED" },
                  { action: "complete", from: "CLEARED", to: "COMPLETED" },
                ],
              },
            },
            fees: {
              defaultTotalDue: 15000,
            },
          }),
        ],
      );
      console.log("Seeded published config for Tenant A");
    });

    // Seed published UI config for Tenant B
    await withTenant(client, idB, async () => {
      await client.query(
        `DELETE FROM platform.config_audit
           WHERE config_id IN (
             SELECT id FROM platform.config_versions
             WHERE tenant_id = $1 AND status = 'published'
           )`,
        [idB],
      );
      await client.query(
        `DELETE FROM platform.config_versions WHERE tenant_id = $1 AND status = 'published'`,
        [idB],
      );
      await client.query(
        `INSERT INTO platform.config_versions (tenant_id, status, payload, published_at, published_by)
         VALUES ($1, 'published', $2::jsonb, now(), 'seed')`,
        [
          idB,
          JSON.stringify({
            modules: { students: true, admissions: false, finance: true },
            branding: { appName: "Riverside Tech College" },
            theme: { primaryColor: "#7C3AED" },
            navigation: {
              admin: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Finance", route: "/finance" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Staff", route: "/staff" },
                { label: "Reports", route: "/reports/it" },
                { label: "Users", route: "/users" },
              ],
              registrar: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
              instructor: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Marks", route: "/marks" },
                { label: "Reports", route: "/reports/it" },
              ],
              finance: [
                { label: "Dashboard", route: "/" },
                { label: "Finance", route: "/finance" },
              ],
              hod: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Programmes", route: "/programmes" },
                { label: "Marks", route: "/marks" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
              principal: [
                { label: "Dashboard", route: "/" },
                { label: "Students", route: "/students" },
                { label: "Admissions", route: "/admissions" },
                { label: "Programmes", route: "/programmes" },
                { label: "Term Registrations", route: "/term-registrations" },
                { label: "Marks", route: "/marks" },
                { label: "Finance", route: "/finance" },
                { label: "Industrial Training", route: "/industrial-training" },
                { label: "Field Placements", route: "/field-placements" },
                { label: "Analytics", route: "/analytics" },
                { label: "Reports", route: "/reports/it" },
              ],
            },
            dashboards: {
              admin: [
                {
                  type: "KPI",
                  label: "Total Students",
                  metricKey: "total_students",
                },
                {
                  type: "ACTION",
                  label: "Enroll Student",
                  route: "/students/new",
                },
              ],
              finance: [
                {
                  type: "KPI",
                  label: "Pending Payments",
                  metricKey: "pending_payments",
                },
              ],
              principal: [
                {
                  type: "KPI",
                  label: "Total Students",
                  metricKey: "total_students",
                },
              ],
            },
            forms: {
              students: {
                fields: [
                  {
                    key: "first_name",
                    label: "First Name",
                    type: "text",
                    visible: true,
                    order: 1,
                  },
                  {
                    key: "last_name",
                    label: "Last Name",
                    type: "text",
                    visible: true,
                    order: 2,
                  },
                  {
                    key: "date_of_birth",
                    label: "Date of Birth",
                    type: "date",
                    visible: true,
                    order: 3,
                  },
                ],
                extensionFields: [],
              },
            },
            workflows: {
              admissions: {
                key: "admissions",
                initial_state: "submitted",
                states: [
                  "submitted",
                  "shortlisted",
                  "interview",
                  "accepted",
                  "rejected",
                ],
                transitions: [
                  { action: "shortlist", from: "submitted", to: "shortlisted" },
                  { action: "interview", from: "shortlisted", to: "interview" },
                  { action: "accept", from: "interview", to: "accepted" },
                  { action: "reject", from: "interview", to: "rejected" },
                ],
              },
              marks: {
                key: "marks",
                initial_state: "DRAFT",
                states: [
                  "DRAFT",
                  "SUBMITTED",
                  "HOD_REVIEW",
                  "APPROVED",
                  "PUBLISHED",
                ],
                transitions: [
                  { action: "submit", from: "DRAFT", to: "SUBMITTED" },
                  { action: "review", from: "SUBMITTED", to: "HOD_REVIEW" },
                  { action: "approve", from: "HOD_REVIEW", to: "APPROVED" },
                  { action: "return", from: "HOD_REVIEW", to: "DRAFT" },
                  { action: "publish", from: "APPROVED", to: "PUBLISHED" },
                ],
              },
              term_registration: {
                key: "term_registration",
                initial_state: "REGISTRATION_STARTED",
                states: [
                  "REGISTRATION_STARTED",
                  "FEE_PAID",
                  "CLEARED",
                  "COMPLETED",
                ],
                transitions: [
                  { action: "pay_fees", from: "REGISTRATION_STARTED", to: "FEE_PAID" },
                  { action: "clear", from: "FEE_PAID", to: "CLEARED" },
                  { action: "complete", from: "CLEARED", to: "COMPLETED" },
                ],
              },
            },
            fees: {
              defaultTotalDue: 12000,
            },
          }),
        ],
      );
      console.log("Seeded published config for Tenant B");
    });

    // Seed dev users — one per role per tenant, deterministic IDs matching
    // the ROLE_IDS in devIdentity.ts so tests can reference known UUIDs.
    //
    // Tenant A IDs: 00000000-0000-0000-0000-00000000000{1..7}
    // Tenant B IDs: 00000000-0000-0000-0000-00000000001{1..7}
    // Password for all: 'Password123!'
    const ROLES: Array<{ role: string; idSuffix: string }> = [
      { role: "admin", idSuffix: "1" },
      { role: "registrar", idSuffix: "2" },
      { role: "hod", idSuffix: "3" },
      { role: "instructor", idSuffix: "4" },
      { role: "finance", idSuffix: "5" },
      { role: "principal", idSuffix: "6" },
      { role: "dean", idSuffix: "7" },
    ];

    const DEV_PASSWORD = "Password123!";
    const pwHash = hashPassword(DEV_PASSWORD);

    // Clean up any users seeded with the old email format so deterministic
    // IDs can be inserted cleanly.
    await client.query(
      `DELETE FROM platform.users
       WHERE email LIKE '%@greenfield.test' OR email LIKE '%@riverside.test'`,
    );

    const devUsers: Array<{
      id: string;
      tenantId: string;
      email: string;
      role: string;
    }> = [
      ...ROLES.map(({ role, idSuffix }) => ({
        id: `00000000-0000-0000-0000-00000000000${idSuffix}`,
        tenantId: idA,
        email: `${role}@tenant-a.test`,
        role,
      })),
      ...ROLES.map(({ role, idSuffix }) => ({
        id: `00000000-0000-0000-0000-00000000001${idSuffix}`,
        tenantId: idB,
        email: `${role}@tenant-b.test`,
        role,
      })),
    ];

    for (const u of devUsers) {
      await client.query(
        `INSERT INTO platform.users (id, tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET tenant_id     = EXCLUDED.tenant_id,
               email         = EXCLUDED.email,
               password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role`,
        [u.id, u.tenantId, u.email, pwHash, u.role],
      );
    }
    console.log(
      `Seeded ${devUsers.length} dev users (7 roles × 2 tenants, password: ${DEV_PASSWORD})`,
    );

    console.log("\nSeed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
