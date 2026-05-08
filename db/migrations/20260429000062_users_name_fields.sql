-- migrate:up
ALTER TABLE platform.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- migrate:down
ALTER TABLE platform.users
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name;
