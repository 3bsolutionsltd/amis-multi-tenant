-- migrate:up

CREATE TABLE app.term_registrations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES platform.tenants(id),
  student_id     uuid        NOT NULL,
  academic_year  text        NOT NULL,    -- e.g. "2026/2027"
  term           text        NOT NULL,    -- e.g. "Term 1"
  extension      jsonb       NOT NULL DEFAULT '{}',
  created_by     uuid        NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, academic_year, term)
);

ALTER TABLE app.term_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.term_registrations FORCE ROW LEVEL SECURITY;

CREATE POLICY term_registrations_tenant_isolation ON app.term_registrations
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.term_registrations TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS term_registrations_tenant_isolation ON app.term_registrations;
DROP TABLE IF EXISTS app.term_registrations;
