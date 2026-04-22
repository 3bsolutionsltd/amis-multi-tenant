-- migrate:up

-- Re-add columns that were lost (likely from a dbmate rollback of 20260410000023)
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS year_of_study smallint,
  ADD COLUMN IF NOT EXISTS class_section text;

-- migrate:down

ALTER TABLE app.students
  DROP COLUMN IF EXISTS year_of_study,
  DROP COLUMN IF EXISTS class_section;
