-- migrate:up

-- Student projects — final-year / coursework projects with linked store issuances
CREATE TABLE app.student_projects (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  student_id      uuid        NOT NULL REFERENCES app.students(id),
  term_id         uuid        REFERENCES app.terms(id),
  course_id       uuid,
  project_title   text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'submitted', 'assessed')),
  mark_entry_id   uuid,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.student_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.student_projects FORCE ROW LEVEL SECURITY;

CREATE POLICY student_projects_tenant ON app.student_projects
  FOR ALL USING (tenant_id = app.current_tenant_id());

CREATE INDEX student_projects_student_idx ON app.student_projects (student_id);
CREATE INDEX student_projects_term_idx    ON app.student_projects (term_id);

GRANT SELECT, INSERT, UPDATE ON app.student_projects TO amis_app;

-- Link store issuances to a student project (nullable — not all issuances are for projects)
ALTER TABLE app.store_issuances
  ADD COLUMN IF NOT EXISTS student_project_id uuid REFERENCES app.student_projects(id);

-- migrate:down

ALTER TABLE app.store_issuances DROP COLUMN IF EXISTS student_project_id;
DROP TABLE IF EXISTS app.student_projects;
