-- migrate:up

-- ============================================================
-- Remove hardcoded fee_type CHECK constraint
-- Allows any tenant-defined fee type string (not limited to
-- 'tuition','functional','examination','other').
-- This is the database prerequisite for the configurable fee
-- types feature (issue #231).
-- ============================================================

ALTER TABLE app.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_fee_type_check;

-- migrate:down

ALTER TABLE app.fee_structures
  ADD CONSTRAINT fee_structures_fee_type_check
    CHECK (fee_type IN ('tuition', 'functional', 'examination', 'other'));
