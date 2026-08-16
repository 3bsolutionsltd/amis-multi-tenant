-- migrate:up

-- Clearance was created before the shared tenant context helper was adopted.
-- Its policy referenced app.current_tenant, but withTenant sets app.tenant_id
-- and app.current_tenant_id() reads that setting safely.
DROP POLICY IF EXISTS tenant_isolation ON app.clearance_signoffs;
CREATE POLICY tenant_isolation ON app.clearance_signoffs
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

ALTER TABLE app.clearance_signoffs FORCE ROW LEVEL SECURITY;

-- migrate:down

ALTER TABLE app.clearance_signoffs NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON app.clearance_signoffs;
CREATE POLICY tenant_isolation ON app.clearance_signoffs
  USING (tenant_id = current_setting('app.current_tenant')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
