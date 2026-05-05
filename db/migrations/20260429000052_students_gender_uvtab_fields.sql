-- migrate:up
-- Restore gender column to app.students (was dropped in migration 005 but required for UVTAB EIMS export).
-- Also expose other_names, nin, and programme_code via the students module (added in migration 037
-- but never wired into the API or frontend).

ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS gender          text CHECK (gender IN ('male', 'female', 'other'));

-- migrate:down
ALTER TABLE app.students
  DROP COLUMN IF EXISTS gender;
