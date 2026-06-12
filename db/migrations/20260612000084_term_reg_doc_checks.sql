-- migrate:up

-- Document checklist items per term registration.
-- Each row records one required document and its verification status.
CREATE TABLE IF NOT EXISTS app.term_registration_doc_checks (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         NOT NULL,
  registration_id uuid         NOT NULL REFERENCES app.term_registrations(id) ON DELETE CASCADE,
  doc_name        text         NOT NULL,
  status          text         NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WAIVED')),
  remarks         text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, registration_id, doc_name)
);

ALTER TABLE app.term_registration_doc_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.term_registration_doc_checks
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON app.term_registration_doc_checks TO amis_app;

-- migrate:down
DROP TABLE IF EXISTS app.term_registration_doc_checks;
