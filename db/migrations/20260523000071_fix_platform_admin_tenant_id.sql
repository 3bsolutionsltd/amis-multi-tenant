-- migrate:up
-- Platform admin users must always have tenant_id = NULL.
-- This migration fixes any existing platform_admin rows that were
-- incorrectly assigned a non-null tenant_id (e.g., created before
-- migration 50 made the column nullable, or seeded with a tenant_id).
-- Without this fix, deleting a VTI whose id matches a platform admin's
-- tenant_id would cascade-delete the platform admin's user record.
UPDATE platform.users
SET tenant_id = NULL
WHERE role = 'platform_admin'
  AND tenant_id IS NOT NULL;

-- Also add a CHECK constraint to enforce this invariant going forward.
ALTER TABLE platform.users
  ADD CONSTRAINT platform_admin_no_tenant
    CHECK (role <> 'platform_admin' OR tenant_id IS NULL);

-- migrate:down
ALTER TABLE platform.users DROP CONSTRAINT IF EXISTS platform_admin_no_tenant;
-- (cannot recover original tenant_id values)
