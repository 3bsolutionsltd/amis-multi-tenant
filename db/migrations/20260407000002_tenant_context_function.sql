-- migrate:up

-- Returns the current tenant UUID set per-transaction by the API.
-- Usage: SET LOCAL app.tenant_id = '<uuid>';
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.tenant_id', true)::uuid;
$$;

-- migrate:down

DROP FUNCTION IF EXISTS app.current_tenant_id();
