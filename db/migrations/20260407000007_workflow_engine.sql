-- migrate:up

-- Runtime state tracker: one row per (tenant, entity_type, entity_id).
-- Workflow definitions live in platform.config_versions.payload.workflows.*
CREATE TABLE app.workflow_instances (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants(id),
  entity_type   text        NOT NULL,   -- e.g. "admission_application"
  entity_id     uuid        NOT NULL,
  workflow_key  text        NOT NULL,   -- matches config payload workflows.<key>
  current_state text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

-- Append-only transition log.
CREATE TABLE app.workflow_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants(id),
  entity_type   text        NOT NULL,
  entity_id     uuid        NOT NULL,
  workflow_key  text        NOT NULL,
  from_state    text        NULL,       -- NULL on the initial "init" event
  to_state      text        NOT NULL,
  action_key    text        NOT NULL,   -- e.g. "shortlist", "__init__"
  actor_user_id uuid        NULL,       -- nullable until auth is live
  meta          jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflow_events_entity_idx
  ON app.workflow_events (tenant_id, entity_type, entity_id, created_at ASC);

-- RLS
ALTER TABLE app.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_instances FORCE ROW LEVEL SECURITY;

ALTER TABLE app.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_events FORCE ROW LEVEL SECURITY;

CREATE POLICY workflow_instances_tenant_isolation ON app.workflow_instances
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY workflow_events_tenant_isolation ON app.workflow_events
  USING (tenant_id = app.current_tenant_id());

-- Prevent UPDATE/DELETE on workflow_events (append-only enforcement via trigger)
CREATE OR REPLACE FUNCTION app.deny_workflow_events_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workflow_events is append-only: % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER workflow_events_no_update
  BEFORE UPDATE ON app.workflow_events
  FOR EACH ROW EXECUTE FUNCTION app.deny_workflow_events_mutation();

CREATE TRIGGER workflow_events_no_delete
  BEFORE DELETE ON app.workflow_events
  FOR EACH ROW EXECUTE FUNCTION app.deny_workflow_events_mutation();

-- Grants
GRANT SELECT, INSERT, UPDATE ON app.workflow_instances TO amis_app;
GRANT SELECT, INSERT ON app.workflow_events TO amis_app;

-- migrate:down

DROP TRIGGER IF EXISTS workflow_events_no_delete ON app.workflow_events;
DROP TRIGGER IF EXISTS workflow_events_no_update ON app.workflow_events;
DROP FUNCTION IF EXISTS app.deny_workflow_events_mutation();
DROP POLICY IF EXISTS workflow_events_tenant_isolation ON app.workflow_events;
DROP POLICY IF EXISTS workflow_instances_tenant_isolation ON app.workflow_instances;
DROP TABLE IF EXISTS app.workflow_events;
DROP TABLE IF EXISTS app.workflow_instances;
