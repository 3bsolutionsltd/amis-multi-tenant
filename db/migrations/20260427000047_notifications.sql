-- migrate:up

-- In-app notification inbox for workflow events.
-- Notifications are created by the API when workflow transitions occur.
-- Filtered by user_id (the recipient from platform.users) and tenant_id (RLS).

CREATE TABLE app.notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,           -- recipient (platform.users.id)
  tenant_id    uuid        NOT NULL REFERENCES platform.tenants(id),
  title        text        NOT NULL,
  body         text        NOT NULL,
  entity_type  text,                           -- e.g. 'purchase_requisition'
  entity_id    uuid,                           -- the specific record
  link         text,                           -- frontend path e.g. /procurement/requisitions/uuid
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_notifications_user_unread_idx
  ON app.notifications (user_id, is_read, created_at DESC);

-- Tenant isolation
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_tenant ON app.notifications
  FOR ALL USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.notifications TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS app.notifications;
