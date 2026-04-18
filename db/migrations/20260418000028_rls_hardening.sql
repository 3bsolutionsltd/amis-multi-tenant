-- migrate:up
-- C1: Standardise all RLS policies to use app.current_tenant_id()
-- instead of direct current_setting('app.tenant_id')::uuid.
-- The function handles missing config gracefully (returns NULL).

-- admission_applications
DROP POLICY IF EXISTS tenant_isolation ON app.admission_applications;
CREATE POLICY tenant_isolation ON app.admission_applications
  USING (tenant_id = app.current_tenant_id());

-- admission_import_batches
DROP POLICY IF EXISTS tenant_isolation ON app.admission_import_batches;
CREATE POLICY tenant_isolation ON app.admission_import_batches
  USING (tenant_id = app.current_tenant_id());

-- mark_submissions
DROP POLICY IF EXISTS tenant_isolation ON app.mark_submissions;
CREATE POLICY tenant_isolation ON app.mark_submissions
  USING (tenant_id = app.current_tenant_id());

-- mark_entries
DROP POLICY IF EXISTS tenant_isolation ON app.mark_entries;
CREATE POLICY tenant_isolation ON app.mark_entries
  USING (tenant_id = app.current_tenant_id());

-- mark_audit_log (append-only: separate SELECT / INSERT policies)
DROP POLICY IF EXISTS tenant_isolation_select ON app.mark_audit_log;
DROP POLICY IF EXISTS tenant_isolation_insert ON app.mark_audit_log;
CREATE POLICY tenant_isolation_select ON app.mark_audit_log
  FOR SELECT USING (tenant_id = app.current_tenant_id());
CREATE POLICY tenant_isolation_insert ON app.mark_audit_log
  FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id());

-- payments
DROP POLICY IF EXISTS tenant_isolation ON app.payments;
CREATE POLICY tenant_isolation ON app.payments
  USING (tenant_id = app.current_tenant_id());

-- fee_audit_log (append-only: separate SELECT / INSERT policies)
DROP POLICY IF EXISTS tenant_isolation_select ON app.fee_audit_log;
DROP POLICY IF EXISTS tenant_isolation_insert ON app.fee_audit_log;
CREATE POLICY tenant_isolation_select ON app.fee_audit_log
  FOR SELECT USING (tenant_id = app.current_tenant_id());
CREATE POLICY tenant_isolation_insert ON app.fee_audit_log
  FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id());

-- C2: Add FORCE ROW LEVEL SECURITY to all business tables missing it.
-- This ensures even the table owner is subject to RLS policies.
ALTER TABLE app.admission_applications   FORCE ROW LEVEL SECURITY;
ALTER TABLE app.admission_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_submissions         FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_entries             FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_audit_log           FORCE ROW LEVEL SECURITY;
ALTER TABLE app.payments                 FORCE ROW LEVEL SECURITY;
ALTER TABLE app.fee_audit_log            FORCE ROW LEVEL SECURITY;
ALTER TABLE app.programmes               FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_profiles           FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_contracts          FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_attendance         FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_appraisals         FORCE ROW LEVEL SECURITY;

-- migrate:down
-- Revert FORCE
ALTER TABLE app.admission_applications   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.admission_import_batches NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_submissions         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_entries             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mark_audit_log           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.payments                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.fee_audit_log            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.programmes               NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_profiles           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_contracts          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_attendance         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.staff_appraisals         NO FORCE ROW LEVEL SECURITY;

-- Revert policies to direct current_setting
DROP POLICY IF EXISTS tenant_isolation ON app.admission_applications;
CREATE POLICY tenant_isolation ON app.admission_applications
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON app.admission_import_batches;
CREATE POLICY tenant_isolation ON app.admission_import_batches
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON app.mark_submissions;
CREATE POLICY tenant_isolation ON app.mark_submissions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON app.mark_entries;
CREATE POLICY tenant_isolation ON app.mark_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation_select ON app.mark_audit_log;
DROP POLICY IF EXISTS tenant_isolation_insert ON app.mark_audit_log;
CREATE POLICY tenant_isolation_select ON app.mark_audit_log
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_insert ON app.mark_audit_log
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON app.payments;
CREATE POLICY tenant_isolation ON app.payments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation_select ON app.fee_audit_log;
DROP POLICY IF EXISTS tenant_isolation_insert ON app.fee_audit_log;
CREATE POLICY tenant_isolation_select ON app.fee_audit_log
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_insert ON app.fee_audit_log
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
