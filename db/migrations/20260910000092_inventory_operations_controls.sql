-- migrate:up

CREATE TABLE app.inventory_replenishment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  item_id uuid NOT NULL REFERENCES app.inventory_items(id),
  quantity_requested numeric(12,3) NOT NULL CHECK (quantity_requested > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'ordered')),
  requested_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.inventory_replenishment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_replenishment_tenant ON app.inventory_replenishment_requests
  FOR ALL USING (tenant_id = app.current_tenant_id());
CREATE INDEX inventory_replenishment_tenant_status
  ON app.inventory_replenishment_requests (tenant_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON app.inventory_replenishment_requests TO amis_app;

CREATE TABLE app.inventory_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.inventory_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_audit_tenant ON app.inventory_audit_log
  FOR ALL USING (tenant_id = app.current_tenant_id());
CREATE INDEX inventory_audit_tenant_created
  ON app.inventory_audit_log (tenant_id, created_at DESC);
GRANT SELECT, INSERT ON app.inventory_audit_log TO amis_app;

-- migrate:down
DROP TABLE IF EXISTS app.inventory_audit_log;
DROP TABLE IF EXISTS app.inventory_replenishment_requests;
