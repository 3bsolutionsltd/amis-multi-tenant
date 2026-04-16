-- migrate:up

-- IT progress reports (SR-F-031)
CREATE TABLE app.it_reports (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES platform.tenants(id),
  industrial_training_id uuid        NOT NULL,
  report_type            text        NOT NULL DEFAULT 'student'
                                     CHECK (report_type IN ('student', 'supervisor')),
  period                 text        NOT NULL,
  summary                text,
  challenges             text,
  recommendations        text,
  rating                 smallint    CHECK (rating BETWEEN 1 AND 5),
  submitted_by           text,
  submitted_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.it_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.it_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY it_reports_tenant_isolation ON app.it_reports
  FOR ALL USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT ON app.it_reports TO amis_app;

-- Teacher evaluations by students (SR-F-032)
CREATE TABLE app.teacher_evaluations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES platform.tenants(id),
  student_id       uuid        NOT NULL,
  staff_id         uuid        NOT NULL,
  academic_period  text        NOT NULL,
  scores           jsonb       NOT NULL DEFAULT '{}',
  comments         text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, staff_id, academic_period)
);

ALTER TABLE app.teacher_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.teacher_evaluations FORCE ROW LEVEL SECURITY;

CREATE POLICY teacher_evaluations_tenant_isolation ON app.teacher_evaluations
  FOR ALL USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT ON app.teacher_evaluations TO amis_app;

-- Instructor periodic reports (SR-F-033)
CREATE TABLE app.instructor_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_id     uuid        NOT NULL,
  report_type  text        NOT NULL DEFAULT 'weekly'
                           CHECK (report_type IN ('weekly', 'monthly')),
  period       text        NOT NULL,
  content      text,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'submitted')),
  due_date     date,
  submitted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.instructor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.instructor_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY instructor_reports_tenant_isolation ON app.instructor_reports
  FOR ALL USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.instructor_reports TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS instructor_reports_tenant_isolation ON app.instructor_reports;
DROP TABLE IF EXISTS app.instructor_reports;

DROP POLICY IF EXISTS teacher_evaluations_tenant_isolation ON app.teacher_evaluations;
DROP TABLE IF EXISTS app.teacher_evaluations;

DROP POLICY IF EXISTS it_reports_tenant_isolation ON app.it_reports;
DROP TABLE IF EXISTS app.it_reports;
