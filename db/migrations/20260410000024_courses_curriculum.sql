-- migrate:up

-- ============================================================
-- Courses (curriculum catalogue)
-- ============================================================
CREATE TABLE app.courses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  programme_id  uuid        NOT NULL REFERENCES app.programmes(id) ON DELETE CASCADE,
  code          text        NOT NULL,         -- e.g. 'BCM101'
  title         text        NOT NULL,
  credit_hours  smallint    NOT NULL DEFAULT 3,
  course_type   text        NOT NULL DEFAULT 'theory'
                            CHECK (course_type IN ('theory', 'practical', 'both')),
  year_of_study smallint    NOT NULL DEFAULT 1 CHECK (year_of_study > 0),
  semester      smallint    NOT NULL DEFAULT 1 CHECK (semester > 0),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courses_tenant_idx ON app.courses (tenant_id);
CREATE INDEX courses_programme_idx ON app.courses (programme_id);

-- Unique course code per tenant
CREATE UNIQUE INDEX courses_tenant_code_idx ON app.courses (tenant_id, code);

ALTER TABLE app.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.courses FORCE ROW LEVEL SECURITY;

CREATE POLICY courses_tenant_isolation ON app.courses
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.courses TO amis_app;

-- ============================================================
-- Course Offerings (a course taught in a specific term by an instructor)
-- ============================================================
CREATE TABLE app.course_offerings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  course_id      uuid        NOT NULL REFERENCES app.courses(id) ON DELETE CASCADE,
  term_id        uuid        NOT NULL REFERENCES app.terms(id) ON DELETE CASCADE,
  instructor_id  uuid        NULL,            -- FK to staff/users; NULL = unassigned
  max_enrollment int         NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX course_offerings_tenant_idx ON app.course_offerings (tenant_id);
CREATE INDEX course_offerings_course_idx ON app.course_offerings (course_id);
CREATE INDEX course_offerings_term_idx ON app.course_offerings (term_id);

-- One offering per course per term (can be relaxed later for sections)
CREATE UNIQUE INDEX course_offerings_course_term_idx
  ON app.course_offerings (course_id, term_id);

ALTER TABLE app.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.course_offerings FORCE ROW LEVEL SECURITY;

CREATE POLICY course_offerings_tenant_isolation ON app.course_offerings
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.course_offerings TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS course_offerings_tenant_isolation ON app.course_offerings;
DROP TABLE IF EXISTS app.course_offerings;

DROP POLICY IF EXISTS courses_tenant_isolation ON app.courses;
DROP TABLE IF EXISTS app.courses;
