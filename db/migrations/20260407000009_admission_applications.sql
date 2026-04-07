-- migrate:up
CREATE TABLE app.admission_applications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  first_name  text        NOT NULL,
  last_name   text        NOT NULL,
  programme   text        NOT NULL,
  intake      text        NOT NULL,
  dob         date,
  gender      text,
  extension   jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.admission_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.admission_applications
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.admission_applications;
