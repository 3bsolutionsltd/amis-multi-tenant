-- migrate:up
CREATE TABLE app.mark_submissions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid        NOT NULL,
  course_id                   text        NOT NULL,
  programme                   text        NOT NULL,
  intake                      text        NOT NULL,
  term                        text        NOT NULL,
  created_by                  uuid,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  correction_of_submission_id uuid        REFERENCES app.mark_submissions(id)
);

ALTER TABLE app.mark_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.mark_submissions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.mark_submissions;
