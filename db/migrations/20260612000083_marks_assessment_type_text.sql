-- migrate:up
-- Convert assessment_type from PostgreSQL enum to text so tenants can freely define
-- TVET assessment types (assignment_1/2, test_1/2, practical_1/2, etc.) without
-- requiring further migrations.

ALTER TABLE app.mark_submissions
  ALTER COLUMN assessment_type TYPE text;

-- Drop the old enum type (no longer needed; validation is in application layer)
DROP TYPE IF EXISTS app.assessment_type CASCADE;

-- migrate:down
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE t.typname = 'assessment_type' AND n.nspname = 'app') THEN
    CREATE TYPE app.assessment_type AS ENUM ('midterm','end_of_term','coursework','practical');
  END IF;
END $$;

ALTER TABLE app.mark_submissions
  ALTER COLUMN assessment_type TYPE app.assessment_type
  USING CASE
    WHEN assessment_type IN ('midterm','end_of_term','coursework','practical')
      THEN assessment_type::app.assessment_type
    ELSE 'end_of_term'::app.assessment_type
  END;
