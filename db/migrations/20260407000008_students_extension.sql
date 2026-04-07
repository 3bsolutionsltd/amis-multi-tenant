-- migrate:up

-- Add extension jsonb for tenant-defined extra fields.
-- Add updated_at for edit tracking.
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS extension   jsonb        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz  NOT NULL DEFAULT now();

-- migrate:down

ALTER TABLE app.students
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS extension;
