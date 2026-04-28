-- migrate:up

-- Platform admin users are cross-tenant and do not belong to any specific tenant.
-- Make tenant_id nullable and enforce via CHECK that only platform_admin may have it NULL.

ALTER TABLE platform.users
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Drop the old unique constraint (tenant_id, email) — it breaks for NULL tenant_id
-- and platform_admin emails should simply be unique on their own.
ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;

-- New constraints:
-- 1. tenant_id must be set for non-platform_admin users
ALTER TABLE platform.users
  ADD CONSTRAINT users_tenant_id_required_for_non_platform_admin
  CHECK (role = 'platform_admin' OR tenant_id IS NOT NULL);

-- 2. (tenant_id, email) unique for tenant users; email alone unique for platform_admin
CREATE UNIQUE INDEX users_tenant_email_unique
  ON platform.users (tenant_id, email)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX users_platform_admin_email_unique
  ON platform.users (email)
  WHERE role = 'platform_admin';

-- migrate:down

DROP INDEX IF EXISTS platform.users_platform_admin_email_unique;
DROP INDEX IF EXISTS platform.users_tenant_email_unique;

ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_tenant_id_required_for_non_platform_admin;

ALTER TABLE platform.users
  ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);

ALTER TABLE platform.users
  ALTER COLUMN tenant_id SET NOT NULL;
