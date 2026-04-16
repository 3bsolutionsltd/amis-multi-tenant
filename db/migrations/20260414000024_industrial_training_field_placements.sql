-- migrate:up

-- Industrial training tracking (SR-F-023)
CREATE TABLE app.industrial_training (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants(id),
  student_id    uuid        NOT NULL,
  company       text        NOT NULL,
  supervisor    text,
  department    text,
  start_date    date,
  end_date      date,
  status        text        NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  notes         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.industrial_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.industrial_training FORCE ROW LEVEL SECURITY;

CREATE POLICY industrial_training_tenant_isolation ON app.industrial_training
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.industrial_training TO amis_app;

-- Field placement tracking (SR-F-026)
CREATE TABLE app.field_placements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES platform.tenants(id),
  student_id        uuid        NOT NULL,
  host_organisation text        NOT NULL,
  supervisor        text,
  placement_type    text        NOT NULL DEFAULT 'field'
                                CHECK (placement_type IN ('field', 'clinical', 'community', 'industry')),
  start_date        date,
  end_date          date,
  status            text        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  notes             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.field_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.field_placements FORCE ROW LEVEL SECURITY;

CREATE POLICY field_placements_tenant_isolation ON app.field_placements
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.field_placements TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS field_placements_tenant_isolation ON app.field_placements;
DROP TABLE IF EXISTS app.field_placements;

DROP POLICY IF EXISTS industrial_training_tenant_isolation ON app.industrial_training;
DROP TABLE IF EXISTS app.industrial_training;
