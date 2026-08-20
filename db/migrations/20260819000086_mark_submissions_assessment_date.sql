-- migrate:up
ALTER TABLE app.mark_submissions
  ADD COLUMN assessment_date date;

-- migrate:down
ALTER TABLE app.mark_submissions
  DROP COLUMN assessment_date;
