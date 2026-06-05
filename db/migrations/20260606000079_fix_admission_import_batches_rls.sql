-- migrate:up
-- Fix RLS policy on app.admission_import_batches to use the null-safe
-- app.current_tenant_id() helper instead of the bare cast
-- current_setting('app.tenant_id')::uuid which throws when the GUC is unset.
-- Also adds a WITH CHECK clause so inserts are also tenant-scoped.

DROP POLICY IF EXISTS admission_import_batches_tenant_isolation ON app.admission_import_batches;

CREATE POLICY admission_import_batches_tenant_isolation
  ON app.admission_import_batches
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

-- migrate:down
DROP POLICY IF EXISTS admission_import_batches_tenant_isolation ON app.admission_import_batches;

CREATE POLICY admission_import_batches_tenant_isolation
  ON app.admission_import_batches
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
