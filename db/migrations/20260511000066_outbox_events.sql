-- Migration 066: platform.outbox_events — outbox queue for offline sync
-- Captures INSERT/UPDATE/DELETE on marks, fees, students as auditable events
-- that a BullMQ worker can drain asynchronously.

-- -------------------------------------------------------------------------
-- Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform.outbox_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  entity_type  text        NOT NULL,
  entity_id    uuid        NOT NULL,
  operation    text        NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Fast lookup for unprocessed events (the worker's primary query pattern)
CREATE INDEX IF NOT EXISTS outbox_events_unprocessed
  ON platform.outbox_events (created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS outbox_events_tenant
  ON platform.outbox_events (tenant_id);

-- -------------------------------------------------------------------------
-- Trigger function — SECURITY DEFINER so that the app role (which has no
-- INSERT privilege on platform schema) can still fire this from its tables.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform.capture_outbox_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = platform, app
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO platform.outbox_events
      (tenant_id, entity_type, entity_id, operation, payload)
    VALUES
      (OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
  ELSE
    INSERT INTO platform.outbox_events
      (tenant_id, entity_type, entity_id, operation, payload)
    VALUES
      (NEW.tenant_id, TG_TABLE_NAME, NEW.id, lower(TG_OP), to_jsonb(NEW));
  END IF;
  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;

-- -------------------------------------------------------------------------
-- Attach triggers to key mutation tables
-- -------------------------------------------------------------------------

-- mark_entries
DROP TRIGGER IF EXISTS trg_outbox_mark_entries ON app.mark_entries;
CREATE TRIGGER trg_outbox_mark_entries
  AFTER INSERT OR UPDATE OR DELETE ON app.mark_entries
  FOR EACH ROW EXECUTE FUNCTION platform.capture_outbox_event();

-- payments
DROP TRIGGER IF EXISTS trg_outbox_payments ON app.payments;
CREATE TRIGGER trg_outbox_payments
  AFTER INSERT OR UPDATE OR DELETE ON app.payments
  FOR EACH ROW EXECUTE FUNCTION platform.capture_outbox_event();

-- students
DROP TRIGGER IF EXISTS trg_outbox_students ON app.students;
CREATE TRIGGER trg_outbox_students
  AFTER INSERT OR UPDATE OR DELETE ON app.students
  FOR EACH ROW EXECUTE FUNCTION platform.capture_outbox_event();
