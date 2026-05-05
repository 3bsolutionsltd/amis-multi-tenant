-- migrate:up

-- -----------------------------------------------------------------------
-- GIN → SRQ link: store issuances now reference the SRQ that authorised them.
-- Also adds tenant config flags for workflow flexibility.
-- -----------------------------------------------------------------------

-- Link GIN to the SRQ that authorised it (nullable — direct GINs still allowed)
ALTER TABLE app.store_issuances
  ADD COLUMN IF NOT EXISTS srq_id uuid REFERENCES app.store_requisitions(id),
  ADD COLUMN IF NOT EXISTS requisition_ref text,
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX store_issuances_srq ON app.store_issuances (srq_id) WHERE srq_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- Tenant config flags (stored in platform.tenants.config JSONB if it exists,
-- otherwise added as a separate lightweight table).
-- We use a simple key-value config table scoped to each tenant.
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform.tenant_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  key         text        NOT NULL,
  value       text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

-- Default values (applied per-tenant on first use via application logic):
-- stores_require_srq   = 'false'  (GIN can be raised directly by default)
-- student_bom_enabled  = 'false'  (student Bill of Materials — optional)

GRANT SELECT, INSERT, UPDATE ON platform.tenant_settings TO amis_app;

-- migrate:down

DROP INDEX IF EXISTS store_issuances_srq;
ALTER TABLE app.store_issuances
  DROP COLUMN IF EXISTS srq_id,
  DROP COLUMN IF EXISTS requisition_ref,
  DROP COLUMN IF EXISTS department;

DROP TABLE IF EXISTS platform.tenant_settings;
