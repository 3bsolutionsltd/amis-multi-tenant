-- migrate:up

CREATE TABLE platform.config_versions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants(id),
  status        text        NOT NULL CHECK (status IN ('draft', 'published', 'rolled_back'))
                            DEFAULT 'draft',
  payload       jsonb       NOT NULL DEFAULT '{}',
  validation_errors jsonb   NULL,
  published_at  timestamptz NULL,
  published_by  text        NULL,
  rollback_of   uuid        NULL REFERENCES platform.config_versions(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one published config per tenant at a time
CREATE UNIQUE INDEX config_versions_tenant_published_unique
  ON platform.config_versions (tenant_id)
  WHERE status = 'published';

-- Audit table for config lifecycle events
CREATE TABLE platform.config_audit (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  config_id       uuid        NOT NULL REFERENCES platform.config_versions(id),
  action          text        NOT NULL CHECK (action IN ('published', 'rolled_back')),
  performed_by    text        NOT NULL DEFAULT 'system',
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS on both tables
ALTER TABLE platform.config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.config_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE platform.config_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.config_audit FORCE ROW LEVEL SECURITY;

CREATE POLICY config_versions_tenant_isolation ON platform.config_versions
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY config_audit_tenant_isolation ON platform.config_audit
  USING (tenant_id = app.current_tenant_id());

-- Grant amis_app role access
GRANT SELECT, INSERT, UPDATE ON platform.config_versions TO amis_app;
GRANT SELECT, INSERT ON platform.config_audit TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS config_audit_tenant_isolation ON platform.config_audit;
DROP POLICY IF EXISTS config_versions_tenant_isolation ON platform.config_versions;
DROP TABLE IF EXISTS platform.config_audit;
DROP TABLE IF EXISTS platform.config_versions;
