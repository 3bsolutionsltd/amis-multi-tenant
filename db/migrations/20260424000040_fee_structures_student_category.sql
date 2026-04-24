-- migrate:up

-- ============================================================
-- Add student_category to fee_structures
-- Supports Boarding / Day Scholar fee differentiation (KTI requirement)
-- Existing rows default to 'all' (applies to both categories)
-- ============================================================

ALTER TABLE app.fee_structures
  ADD COLUMN student_category text NOT NULL DEFAULT 'all'
    CHECK (student_category IN ('all', 'boarding', 'day'));

-- Drop old unique index and recreate including student_category
DROP INDEX IF EXISTS app.fee_structures_unique_idx;

CREATE UNIQUE INDEX fee_structures_unique_idx
  ON app.fee_structures (
    tenant_id,
    academic_year_id,
    COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid),
    programme_id,
    fee_type,
    student_category
  );

-- migrate:down

DROP INDEX IF EXISTS app.fee_structures_unique_idx;

ALTER TABLE app.fee_structures DROP COLUMN IF EXISTS student_category;

CREATE UNIQUE INDEX fee_structures_unique_idx
  ON app.fee_structures (
    tenant_id,
    academic_year_id,
    COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid),
    programme_id,
    fee_type
  );
