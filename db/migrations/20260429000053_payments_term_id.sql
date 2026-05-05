-- migrate:up
-- Issue #84: Payments have no term_id
-- Add term_id and academic_year_id so payments can be reconciled per term.
-- Both columns are nullable to preserve existing payment rows.

ALTER TABLE app.payments
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES app.academic_years(id),
  ADD COLUMN IF NOT EXISTS term_id          uuid REFERENCES app.terms(id);

CREATE INDEX IF NOT EXISTS payments_term_id_idx          ON app.payments (term_id);
CREATE INDEX IF NOT EXISTS payments_academic_year_id_idx ON app.payments (academic_year_id);

-- migrate:down
DROP INDEX IF EXISTS app.payments_term_id_idx;
DROP INDEX IF EXISTS app.payments_academic_year_id_idx;
ALTER TABLE app.payments
  DROP COLUMN IF EXISTS term_id,
  DROP COLUMN IF EXISTS academic_year_id;
