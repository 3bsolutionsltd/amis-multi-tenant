-- migrate:up

-- Supervisor PIN hash for IT assignments (bcrypt-hashed 4-digit PIN)
ALTER TABLE app.industrial_training
  ADD COLUMN IF NOT EXISTS supervisor_pin_hash text;

-- Daily logbook entries — one per student per day per assignment
CREATE TABLE app.it_log_entries (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES platform.tenants(id),
  it_assignment_id      uuid        NOT NULL REFERENCES app.industrial_training(id) ON DELETE CASCADE,
  student_id            uuid        NOT NULL REFERENCES app.students(id),
  log_date              date        NOT NULL,
  task_description      text        NOT NULL,
  learning_points       text,
  supervisor_verified   boolean     NOT NULL DEFAULT false,
  verified_at           timestamptz,
  verified_by_name      text,
  verification_method   text        CHECK (verification_method IN ('pin', 'signature', 'manual')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- one log entry per assignment per calendar day
  UNIQUE (it_assignment_id, log_date)
);

ALTER TABLE app.it_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.it_log_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY it_log_entries_tenant ON app.it_log_entries
  FOR ALL USING (tenant_id = app.current_tenant_id());

CREATE INDEX it_log_entries_assignment_idx ON app.it_log_entries (it_assignment_id);
CREATE INDEX it_log_entries_student_idx    ON app.it_log_entries (student_id);
CREATE INDEX it_log_entries_date_idx       ON app.it_log_entries (log_date);

GRANT SELECT, INSERT, UPDATE ON app.it_log_entries TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS app.it_log_entries;
ALTER TABLE app.industrial_training DROP COLUMN IF EXISTS supervisor_pin_hash;
