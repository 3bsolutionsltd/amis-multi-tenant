-- migrate:up

-- Admissions: add contact + sponsorship columns
ALTER TABLE app.admission_applications
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS sponsorship_type text;

-- Students: add admission number, sponsorship, programme, contact
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS sponsorship_type text,
  ADD COLUMN IF NOT EXISTS programme        text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS phone            text;

-- Unique admission number per tenant (NULLs excluded)
CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_admission_number_idx
  ON app.students (tenant_id, admission_number)
  WHERE admission_number IS NOT NULL;

-- Payments: change default currency from ZAR to UGX
ALTER TABLE app.payments ALTER COLUMN currency SET DEFAULT 'UGX';

-- migrate:down

ALTER TABLE app.admission_applications
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS sponsorship_type;

ALTER TABLE app.students
  DROP COLUMN IF EXISTS admission_number,
  DROP COLUMN IF EXISTS sponsorship_type,
  DROP COLUMN IF EXISTS programme,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;

DROP INDEX IF EXISTS app.students_tenant_admission_number_idx;

ALTER TABLE app.payments ALTER COLUMN currency SET DEFAULT 'ZAR';
