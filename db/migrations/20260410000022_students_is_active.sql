-- migrate:up

ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- migrate:down

ALTER TABLE app.students DROP COLUMN IF EXISTS is_active;
