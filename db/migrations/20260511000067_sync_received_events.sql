-- migrate:up

-- Tracks client-side offline events received via POST /sync/flush.
-- The event_id (client-generated UUID) is the idempotency key — duplicate
-- submissions are silently skipped so the endpoint is safe to retry.

CREATE TABLE IF NOT EXISTS platform.sync_received_events (
  event_id          uuid        PRIMARY KEY,
  tenant_id         uuid        NOT NULL,
  entity_type       text        NOT NULL,
  entity_id         uuid        NOT NULL,
  operation         text        NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload           jsonb,
  client_timestamp  timestamptz,
  received_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sync_received_events_tenant_idx
  ON platform.sync_received_events (tenant_id);

CREATE INDEX sync_received_events_entity_idx
  ON platform.sync_received_events (tenant_id, entity_type, entity_id);

-- migrate:down
DROP TABLE IF EXISTS platform.sync_received_events;
