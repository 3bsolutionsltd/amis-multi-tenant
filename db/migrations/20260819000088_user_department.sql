-- migrate:up

ALTER TABLE platform.users
  ADD COLUMN IF NOT EXISTS department text;

-- migrate:down

ALTER TABLE platform.users
  DROP COLUMN IF EXISTS department;