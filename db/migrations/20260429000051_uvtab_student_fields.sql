-- migrate:up
-- Add UVTAB EIMS export fields to app.students
-- These are required for the standardised registration CSV upload to the UVTAB EIMS portal.

ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS assessment_level  smallint CHECK (assessment_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS previous_index    text;   -- PLE or UCE index number for identity verification

COMMENT ON COLUMN app.students.assessment_level IS
  'UVTAB modular/full occupation certificate level (1–4)';
COMMENT ON COLUMN app.students.previous_index IS
  'PLE or UCE index number used by UVTAB EIMS for identity verification';

-- migrate:down
ALTER TABLE app.students
  DROP COLUMN IF EXISTS assessment_level,
  DROP COLUMN IF EXISTS previous_index;
