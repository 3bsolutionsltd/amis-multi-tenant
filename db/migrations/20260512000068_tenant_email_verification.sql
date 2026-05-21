-- migrate:up
-- Add contact email verification tracking to tenants
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS contact_email_verified       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contact_email_verified_at    TIMESTAMPTZ;

-- Verification tokens for tenant contact email
CREATE TABLE IF NOT EXISTS platform.tenant_email_verifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_verif_tenant
  ON platform.tenant_email_verifications(tenant_id);

GRANT SELECT, INSERT, UPDATE ON platform.tenant_email_verifications TO amis_app;

-- migrate:down
ALTER TABLE platform.tenants
  DROP COLUMN IF EXISTS contact_email_verified,
  DROP COLUMN IF EXISTS contact_email_verified_at;

DROP TABLE IF EXISTS platform.tenant_email_verifications;
