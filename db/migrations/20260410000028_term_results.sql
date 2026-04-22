-- migrate:up
CREATE TABLE app.term_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL,
  term_id        uuid        NOT NULL,
  student_id     uuid        NOT NULL REFERENCES app.students(id),
  course_id      text        NOT NULL,
  score          numeric     NOT NULL,
  grade          text,
  grade_point    numeric,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_results_term_student_course_unique
    UNIQUE (term_id, student_id, course_id)
);

-- GPA / ranking summary per student per term
CREATE TABLE app.term_gpa (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL,
  term_id        uuid        NOT NULL,
  student_id     uuid        NOT NULL REFERENCES app.students(id),
  gpa            numeric     NOT NULL,
  total_credits  int         NOT NULL DEFAULT 0,
  rank           int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_gpa_term_student_unique UNIQUE (term_id, student_id)
);

ALTER TABLE app.term_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.term_gpa     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.term_results
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON app.term_gpa
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.term_gpa;
DROP TABLE IF EXISTS app.term_results;
