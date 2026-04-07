-- migrate:up
CREATE TABLE app.admission_import_batches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  filename    text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',
  row_count   int         NOT NULL DEFAULT 0,
  imported_by uuid,
  meta        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.admission_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.admission_import_batches
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.admission_import_batches;
