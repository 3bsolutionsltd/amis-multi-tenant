-- migrate:up

-- Programme catalog table (SR-F-012)
CREATE TABLE IF NOT EXISTS app.programmes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  code             text        NOT NULL,
  title            text        NOT NULL,
  department       text,
  duration_months  int,
  level            text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE app.programmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY programmes_tenant_isolation ON app.programmes
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON app.programmes TO amis_app;

-- Add programme_id FK to students (nullable — backwards compatible)
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES app.programmes(id);

-- Add programme_id FK to admissions (nullable — backwards compatible)
ALTER TABLE app.admission_applications
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES app.programmes(id);

-- migrate:down

ALTER TABLE app.admission_applications DROP COLUMN IF EXISTS programme_id;
ALTER TABLE app.students DROP COLUMN IF EXISTS programme_id;

DROP POLICY IF EXISTS programmes_tenant_isolation ON app.programmes;
DROP TABLE IF EXISTS app.programmes;
