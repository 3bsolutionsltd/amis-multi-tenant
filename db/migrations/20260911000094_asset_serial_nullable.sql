-- migrate:up

ALTER TABLE app.assets DROP CONSTRAINT IF EXISTS assets_tenant_id_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS assets_tenant_serial_number_unique
  ON app.assets (tenant_id, serial_number)
  WHERE serial_number IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS assets_tenant_serial_number_unique;
ALTER TABLE app.assets ADD CONSTRAINT assets_tenant_id_serial_number_key
  UNIQUE NULLS NOT DISTINCT (tenant_id, serial_number);