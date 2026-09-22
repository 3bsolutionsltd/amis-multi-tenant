-- migrate:up
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS residence_category text;

ALTER TABLE app.students
  DROP CONSTRAINT IF EXISTS students_residence_category_check;

ALTER TABLE app.students
  ADD CONSTRAINT students_residence_category_check
  CHECK (residence_category IS NULL OR residence_category IN ('day', 'boarding'));

-- migrate:down
ALTER TABLE app.students
  DROP CONSTRAINT IF EXISTS students_residence_category_check;
ALTER TABLE app.students
  DROP COLUMN IF EXISTS residence_category;
