-- migrate:up

-- 1. Add 'platform_admin' to the role constraint.
--    DROP + re-ADD is the portable way to change a CHECK body.
ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal', 'dean', 'platform_admin'
    ));

-- 2. Track whether a tenant has completed their initial setup wizard.
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_email text;

-- 3. Store the initial admin email when provisioning a new VTI,
--    so the onboarding endpoint can return it as a credential hint.
--    (column already added above via created_by_email)

-- 4. Grant the amis_app role access to query tenants without RLS issues
--    when acting as platform_admin (they query without a tenant context).
--    We do this by adding a BYPASSRLS policy check in application logic,
--    not at the DB level, so no schema change needed here.

-- migrate:down

ALTER TABLE platform.tenants
  DROP COLUMN IF EXISTS created_by_email,
  DROP COLUMN IF EXISTS setup_completed_at,
  DROP COLUMN IF EXISTS setup_completed;

ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal', 'dean'
    ));
