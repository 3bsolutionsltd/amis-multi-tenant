-- migrate:up

-- SR-F-002: Guardian / next-of-kin fields on student profile
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS guardian_name         text,
  ADD COLUMN IF NOT EXISTS guardian_phone        text,
  ADD COLUMN IF NOT EXISTS guardian_email        text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text;

-- SR-F-003: Dropout tracking (set when is_active → false)
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS dropout_reason text,
  ADD COLUMN IF NOT EXISTS dropout_date   date,
  ADD COLUMN IF NOT EXISTS dropout_notes  text;

-- migrate:down

ALTER TABLE app.students
  DROP COLUMN IF EXISTS guardian_name,
  DROP COLUMN IF EXISTS guardian_phone,
  DROP COLUMN IF EXISTS guardian_email,
  DROP COLUMN IF EXISTS guardian_relationship,
  DROP COLUMN IF EXISTS dropout_reason,
  DROP COLUMN IF EXISTS dropout_date,
  DROP COLUMN IF EXISTS dropout_notes;
