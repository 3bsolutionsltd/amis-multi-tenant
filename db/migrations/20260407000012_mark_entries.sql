-- migrate:up
CREATE TABLE app.mark_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  submission_id uuid        NOT NULL REFERENCES app.mark_submissions(id),
  student_id    uuid        NOT NULL,
  score         numeric     NOT NULL,
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mark_entries_submission_student_unique UNIQUE (submission_id, student_id)
);

ALTER TABLE app.mark_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.mark_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.mark_entries;
