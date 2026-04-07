-- migrate:up
CREATE TABLE app.payments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  student_id  uuid        NOT NULL,
  amount      numeric     NOT NULL CHECK (amount > 0),
  currency    text        NOT NULL DEFAULT 'ZAR',
  reference   text        NOT NULL,
  paid_at     timestamptz NOT NULL,
  source      text        NOT NULL DEFAULT 'manual',
  imported_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.payments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.payments;
