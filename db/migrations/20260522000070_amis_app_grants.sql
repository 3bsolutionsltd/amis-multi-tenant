-- migrate:up

-- Migration 20260407000005 created amis_app and granted privileges only on
-- the tables that existed at that time. Many tables have been added since
-- (workflow engine, admissions, staff, fees, marks, etc.) and amis_app has
-- no access to them. This migration:
--   1. Re-encodes amis_app password as scram-sha-256 (pg_hba.conf requires
--      scram-sha-256 for TCP connections; if the password was stored as MD5
--      from a prior migration run, external authentication hangs/fails).
--   2. Re-grants on ALL current tables in app + platform schemas.
--   3. Grants USAGE on all sequences (needed for INSERT with serial/bigserial cols).
--   4. Sets DEFAULT PRIVILEGES so any future table/sequence created by the
--      migration runner (superuser) is automatically accessible to amis_app.

-- 0. Reset password with explicit scram-sha-256 encoding so TCP connections work
SET password_encryption = 'scram-sha-256';
ALTER ROLE amis_app PASSWORD 'amis_dev';
RESET password_encryption;

-- 1. Current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app      TO amis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;

-- 2. Current sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app      TO amis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO amis_app;

-- 3. Default privileges for future objects created by the superuser role
--    that runs migrations (covers any new tables/sequences added later).
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT USAGE, SELECT ON SEQUENCES TO amis_app;

-- migrate:down
ALTER DEFAULT PRIVILEGES IN SCHEMA app      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app      REVOKE USAGE, SELECT ON SEQUENCES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform REVOKE USAGE, SELECT ON SEQUENCES FROM amis_app;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app      FROM amis_app;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform FROM amis_app;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app      FROM amis_app;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform FROM amis_app;
