-- migrate:up
-- Migration data fields for student import from VTI source files
-- Required by Phase 2 student importer

ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS registration_number  text,   -- Institution internal reg number (e.g. UVT212/U/25/M/NCES/0313)
  ADD COLUMN IF NOT EXISTS other_names          text,   -- Middle / additional names
  ADD COLUMN IF NOT EXISTS nin                  text,   -- National Identity Number (NIRA)
  ADD COLUMN IF NOT EXISTS district_of_origin   text,   -- District (from student register)
  ADD COLUMN IF NOT EXISTS intake_year          text,   -- Academic year of intake (e.g. 2025/2026)
  ADD COLUMN IF NOT EXISTS programme_code       text;   -- Programme code shorthand (e.g. NCES, NCBC)

-- Unique constraint so duplicate imports are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_reg_number_idx
  ON app.students (tenant_id, registration_number)
  WHERE registration_number IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS app.students_tenant_reg_number_idx;

ALTER TABLE app.students
  DROP COLUMN IF EXISTS registration_number,
  DROP COLUMN IF EXISTS other_names,
  DROP COLUMN IF EXISTS nin,
  DROP COLUMN IF EXISTS district_of_origin,
  DROP COLUMN IF EXISTS intake_year,
  DROP COLUMN IF EXISTS programme_code;
