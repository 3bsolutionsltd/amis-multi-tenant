-- migrate:up

-- Fix schema: split full_name into first_name + last_name (matches API schema)
ALTER TABLE app.students
  ADD COLUMN first_name text,
  ADD COLUMN last_name  text;

UPDATE app.students
  SET first_name = split_part(full_name, ' ', 1),
      last_name  = NULLIF(trim(substring(full_name FROM position(' ' IN full_name) + 1)), '');

-- Ensure no NULLs before applying NOT NULL
UPDATE app.students SET last_name = '' WHERE last_name IS NULL;

ALTER TABLE app.students
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name  SET NOT NULL,
  DROP COLUMN full_name,
  DROP COLUMN gender,
  DROP COLUMN updated_at;

-- Force RLS on table owner so non-superuser app role is properly isolated.
-- Note: superusers always bypass RLS. Use the amis_app role for the API in production.
ALTER TABLE app.students FORCE ROW LEVEL SECURITY;

-- Create a non-superuser application role for the API.
-- This role is subject to RLS (unlike postgres superuser).
DO $$
BEGIN
  CREATE ROLE amis_app LOGIN PASSWORD 'amis_dev';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT CONNECT ON DATABASE amis_multi_tenant TO amis_app;
GRANT USAGE ON SCHEMA app       TO amis_app;
GRANT USAGE ON SCHEMA platform  TO amis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app      TO amis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;

-- migrate:down
REVOKE ALL ON ALL TABLES IN SCHEMA app      FROM amis_app;
REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM amis_app;
REVOKE CONNECT ON DATABASE amis_multi_tenant FROM amis_app;
DROP ROLE IF EXISTS amis_app;

ALTER TABLE app.students NO FORCE ROW LEVEL SECURITY;

ALTER TABLE app.students
  ADD COLUMN full_name  text        NOT NULL DEFAULT '',
  ADD COLUMN gender     text        CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE app.students SET full_name = first_name || ' ' || last_name;

ALTER TABLE app.students
  DROP COLUMN first_name,
  DROP COLUMN last_name;
