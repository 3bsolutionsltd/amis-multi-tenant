import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

try {
  const envPath = resolve(process.cwd(), ".env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // Use DATABASE_URL from the environment when no local .env file exists.
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const tenantId = "10e575a2-2e59-437b-b251-c5b906a482d8";
const tenantSlug = "greenfield-vti";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

    const tenant = await client.query<{ id: string }>(
      `SELECT id FROM platform.tenants WHERE id = $1 AND slug = $2`,
      [tenantId, tenantSlug],
    );
    if (tenant.rowCount !== 1) {
      throw new Error(`Tenant ${tenantSlug} does not exist. Run pnpm seed first.`);
    }

    const academicYear = await client.query<{ id: string }>(
      `INSERT INTO app.academic_years
         (tenant_id, name, start_date, end_date, is_current)
       VALUES ($1, '2026/2027', '2026-08-01', '2027-07-31', true)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [tenantId],
    );
    const academicYearId = academicYear.rows[0]?.id ?? (
      await client.query<{ id: string }>(
        `SELECT id FROM app.academic_years
         WHERE tenant_id = $1 AND name = '2026/2027'`,
        [tenantId],
      )
    ).rows[0]?.id;
    if (!academicYearId) throw new Error("Could not create or find academic year 2026/2027");

    const term = await client.query<{ id: string }>(
      `INSERT INTO app.terms
         (tenant_id, academic_year_id, name, term_number, start_date, end_date, is_current)
       VALUES ($1, $2, 'Term 1', 1, '2026-08-01', '2026-12-15', true)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [tenantId, academicYearId],
    );
    const termId = term.rows[0]?.id ?? (
      await client.query<{ id: string }>(
        `SELECT id FROM app.terms
         WHERE tenant_id = $1 AND academic_year_id = $2 AND term_number = 1`,
        [tenantId, academicYearId],
      )
    ).rows[0]?.id;
    if (!termId) throw new Error("Could not create or find Term 1");

    const programmes = await client.query<{ id: string; code: string; title: string }>(
      `SELECT id, code, title FROM app.programmes
       WHERE tenant_id = $1 AND code IN ('NCBC', 'NCES')`,
      [tenantId],
    );
    const ncbc = programmes.rows.find((programme) => programme.code === "NCBC");
    const nces = programmes.rows.find((programme) => programme.code === "NCES");
    if (!ncbc || !nces) throw new Error("Run pnpm seed first to create NCBC and NCES programmes.");

    const feeRows = [
      [ncbc.id, "tuition", "NCBC day tuition", 1200000, "day"],
      [ncbc.id, "tuition", "NCBC boarding tuition", 1650000, "boarding"],
      [ncbc.id, "functional", "NCBC day functional fees", 150000, "day"],
      [ncbc.id, "functional", "NCBC boarding functional fees", 200000, "boarding"],
      [nces.id, "tuition", "NCES day tuition", 1400000, "day"],
      [nces.id, "tuition", "NCES boarding tuition", 1850000, "boarding"],
    ] as const;
    for (const [programmeId, feeType, description, amount, studentCategory] of feeRows) {
      await client.query(
        `INSERT INTO app.fee_structures
           (tenant_id, academic_year_id, term_id, programme_id, fee_type, description, amount, currency, student_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'UGX', $8)
         ON CONFLICT DO NOTHING`,
        [tenantId, academicYearId, termId, programmeId, feeType, description, amount, studentCategory],
      );
    }

    const students = [
      ["TEST-FIN-001", "Amina", "Nabirye", "Government", "day", ncbc, 1, "amina.nabirye@test.amis.institute"],
      ["TEST-FIN-002", "Brian", "Okello", "Government", "boarding", ncbc, 1, "brian.okello@test.amis.institute"],
      ["TEST-FIN-003", "Carol", "Mutesi", "Private", "day", nces, 2, "carol.mutesi@test.amis.institute"],
      ["TEST-FIN-004", "Daniel", "Kato", "Private", "boarding", nces, 2, "daniel.kato@test.amis.institute"],
    ] as const;

    const studentIds = new Map<string, string>();
    for (const [registrationNumber, firstName, lastName, sponsorshipType, residenceCategory, programme, yearOfStudy, email] of students) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO app.students
           (tenant_id, first_name, last_name, date_of_birth, admission_number,
            registration_number, sponsorship_type, residence_category, programme,
            programme_code, programme_id, year_of_study, email, phone)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (tenant_id, registration_number) WHERE registration_number IS NOT NULL DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           sponsorship_type = EXCLUDED.sponsorship_type,
           residence_category = EXCLUDED.residence_category,
           programme = EXCLUDED.programme,
           programme_code = EXCLUDED.programme_code,
           programme_id = EXCLUDED.programme_id,
           year_of_study = EXCLUDED.year_of_study,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone
         RETURNING id`,
        [tenantId, firstName, lastName, "2005-02-14", registrationNumber, sponsorshipType, residenceCategory, programme.title, programme.code, programme.id, yearOfStudy, email, "+256700000001"],
      );
      studentIds.set(registrationNumber, result.rows[0].id);
    }

    const payments = [
      ["TEST-FIN-PAY-001", "TEST-FIN-001", 500000, "2026-09-03"],
      ["TEST-FIN-PAY-002", "TEST-FIN-002", 900000, "2026-09-04"],
      ["TEST-FIN-PAY-003", "TEST-FIN-003", 750000, "2026-09-05"],
      ["TEST-FIN-PAY-004", "TEST-FIN-004", 1250000, "2026-09-06"],
    ] as const;
    for (const [reference, registrationNumber, amount, paidAt] of payments) {
      await client.query(
        `INSERT INTO app.payments
           (tenant_id, student_id, amount, currency, reference, paid_at, source,
            receipt_number, payment_date, term, fee_type, programme_code, sponsorship_type, match_confidence)
         SELECT $1, $2, $3, 'UGX', $4, $5::timestamptz, 'manual', $4, $5::date,
                'Term 1', 'tuition', s.programme_code, s.sponsorship_type, 1.000
         FROM app.students s
         WHERE s.id = $2
           AND NOT EXISTS (SELECT 1 FROM app.payments WHERE tenant_id = $1 AND reference = $4)`,
        [tenantId, studentIds.get(registrationNumber), amount, reference, `${paidAt}T10:00:00Z`],
      );
    }

    await client.query("COMMIT");
    console.log("Finance test data ready for Greenfield VTI");
    console.log(`Tenant ID: ${tenantId}`);
    console.log("Students: TEST-FIN-001 through TEST-FIN-004");
    console.log("Payment references: TEST-FIN-PAY-001 through TEST-FIN-PAY-004");
    console.log("Matrix: Government/Private x day/boarding; NCBC and NCES; years 1 and 2");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
