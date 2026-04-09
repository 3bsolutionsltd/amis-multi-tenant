-- migrate:up

-- 1. Add 'dean' to the platform.users role check constraint.
--    DROP + re-ADD is the only portable way to change a CHECK body.
ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal', 'dean'
    ));

-- 2. Enable RLS on platform.users so that the amis_app role only sees
--    rows belonging to the active tenant (set via app.tenant_id).
--    The postgres superuser (used for auth lookups) always bypasses RLS.
ALTER TABLE platform.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON platform.users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 3. Create the refresh_tokens table (used from Prompt 17 onward).
CREATE TABLE platform.refresh_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_id_idx ON platform.refresh_tokens (user_id);

-- Ensure the amis_app role can read/write refresh_tokens.
-- (SELECT, INSERT, UPDATE already granted on all platform tables in migration 05;
--  this is a safety net for tables created after that grant.)
GRANT SELECT, INSERT, UPDATE ON platform.refresh_tokens TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS platform.refresh_tokens;

DROP POLICY IF EXISTS users_tenant_isolation ON platform.users;
ALTER TABLE platform.users DISABLE ROW LEVEL SECURITY;

ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal'
    ));
