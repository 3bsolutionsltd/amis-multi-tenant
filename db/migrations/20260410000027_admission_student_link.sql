-- migrate:up
ALTER TABLE app.admission_applications
  ADD COLUMN student_id uuid REFERENCES app.students(id);

CREATE INDEX idx_admission_applications_student_id
  ON app.admission_applications(student_id)
  WHERE student_id IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS app.idx_admission_applications_student_id;
ALTER TABLE app.admission_applications DROP COLUMN IF EXISTS student_id;
