-- migrate:up

ALTER TABLE platform.tenants
  ADD COLUMN is_active      boolean     NOT NULL DEFAULT true,
  ADD COLUMN contact_email  text,
  ADD COLUMN address        text,
  ADD COLUMN phone          text,
  ADD COLUMN logo_url       text;

-- migrate:down

ALTER TABLE platform.tenants
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS is_active;
