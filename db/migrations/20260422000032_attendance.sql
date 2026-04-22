-- migrate:up

CREATE TABLE IF NOT EXISTS app.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  student_id      UUID NOT NULL REFERENCES app.students(id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL,
  programme       TEXT NOT NULL,
  academic_year   TEXT NOT NULL,
  term_number     INTEGER NOT NULL CHECK (term_number BETWEEN 1 AND 4),
  date            DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present','absent','late','excused')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- one record per student per course per date
  UNIQUE (tenant_id, student_id, course_id, date)
);

ALTER TABLE app.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_tenant ON app.attendance
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE INDEX idx_attendance_tenant_course_date
  ON app.attendance (tenant_id, course_id, date);

CREATE INDEX idx_attendance_tenant_student
  ON app.attendance (tenant_id, student_id);

-- migrate:down

DROP TABLE IF EXISTS app.attendance;
