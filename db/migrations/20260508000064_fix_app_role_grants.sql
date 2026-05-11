-- migrate:up
-- Fix: ensure amis_app has access to ALL tables (including those created after
-- migration 005) and that future tables are automatically granted.
--
-- Background: migration 005 created the amis_app role and granted it
-- "ON ALL TABLES IN SCHEMA app" — but that only covers tables that existed
-- at that moment. Tables added in later migrations (admissions, marks, payments,
-- fee_audit_log, academic_calendar, courses, staff, etc.) were never granted.
-- Without these grants the API pool cannot use amis_app, forcing it to fall
-- back to the postgres superuser which bypasses RLS entirely.

-- Re-grant sequences as well (needed for INSERT ... RETURNING / serial cols)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app      TO amis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO amis_app;

-- Catch-all grant for any tables created since migration 005
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app      TO amis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO amis_app;

-- Ensure all FUTURE tables in these schemas are automatically granted to amis_app.
-- This runs as the current migration owner (postgres superuser), so ALTER DEFAULT
-- PRIVILEGES applies to tables created by the same owner going forward.
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO amis_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT USAGE, SELECT ON SEQUENCES TO amis_app;

-- Grant EXECUTE on all functions so amis_app can call app.current_tenant_id()
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app      TO amis_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA platform TO amis_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA app      GRANT EXECUTE ON FUNCTIONS TO amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT EXECUTE ON FUNCTIONS TO amis_app;

-- migrate:down
-- Note: revoking default privileges does not retroactively revoke granted
-- permissions. Individual revokes are handled by dropping the role.
ALTER DEFAULT PRIVILEGES IN SCHEMA app      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app      REVOKE USAGE, SELECT ON SEQUENCES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform REVOKE USAGE, SELECT ON SEQUENCES FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app      REVOKE EXECUTE ON FUNCTIONS FROM amis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform REVOKE EXECUTE ON FUNCTIONS FROM amis_app;
