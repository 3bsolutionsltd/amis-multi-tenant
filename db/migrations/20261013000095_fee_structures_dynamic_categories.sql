-- migrate:up

-- Fee types and student categories are tenant-configurable. The API validates
-- non-empty values and fee matching normalizes categories case-insensitively.
ALTER TABLE app.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_student_category_check;

-- migrate:down

ALTER TABLE app.fee_structures
  ADD CONSTRAINT fee_structures_student_category_check
  CHECK (student_category IN ('all', 'boarding', 'day'));
