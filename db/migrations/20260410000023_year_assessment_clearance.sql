-- migrate:up

-- #60: year_of_study and class_section tracking
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS year_of_study smallint,
  ADD COLUMN IF NOT EXISTS class_section text;

-- #61: exam/assessment types on mark submissions
DO $$ BEGIN
  CREATE TYPE app.assessment_type AS ENUM ('midterm','end_of_term','coursework','practical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app.mark_submissions
  ADD COLUMN IF NOT EXISTS assessment_type app.assessment_type NOT NULL DEFAULT 'end_of_term',
  ADD COLUMN IF NOT EXISTS weight numeric(5,2);

-- #58: clearance sign-off tracking (8 departments)
CREATE TABLE IF NOT EXISTS app.clearance_signoffs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  student_id   uuid NOT NULL REFERENCES app.students(id),
  term_id      uuid NOT NULL,
  department   text NOT NULL,  -- store,library,sports,warden,hod,dean_of_students,accounts,academic_registrar
  signed_by    uuid,
  signed_at    timestamptz,
  status       text NOT NULL DEFAULT 'PENDING',  -- PENDING, SIGNED, REJECTED
  remarks      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, term_id, department)
);

-- RLS for clearance_signoffs
ALTER TABLE app.clearance_signoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON app.clearance_signoffs;
CREATE POLICY tenant_isolation ON app.clearance_signoffs
  USING  (tenant_id = current_setting('app.current_tenant')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- migrate:down

ALTER TABLE app.students
  DROP COLUMN IF EXISTS year_of_study,
  DROP COLUMN IF EXISTS class_section;

ALTER TABLE app.mark_submissions
  DROP COLUMN IF EXISTS assessment_type,
  DROP COLUMN IF EXISTS weight;

DROP TABLE IF EXISTS app.clearance_signoffs;
DROP TYPE IF EXISTS app.assessment_type;
