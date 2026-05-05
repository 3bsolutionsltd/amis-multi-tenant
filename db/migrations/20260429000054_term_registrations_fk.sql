-- migrate:up
-- Issue #85: Term registrations use free-text labels, not FK references.
-- Add academic_year_id and term_id FK columns alongside the existing text fields.
-- The text fields are kept for backward compatibility; the FK columns are nullable
-- so existing rows are preserved.  New registrations should populate both.

ALTER TABLE app.term_registrations
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES app.academic_years(id),
  ADD COLUMN IF NOT EXISTS term_id          uuid REFERENCES app.terms(id);

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS term_registrations_academic_year_id_idx
  ON app.term_registrations (academic_year_id);

CREATE INDEX IF NOT EXISTS term_registrations_term_id_idx
  ON app.term_registrations (term_id);

-- Back-fill: link existing rows to academic_year/term records where the text
-- labels match exactly, within the same tenant.
UPDATE app.term_registrations tr
SET academic_year_id = ay.id
FROM app.academic_years ay
WHERE ay.tenant_id = tr.tenant_id
  AND ay.name      = tr.academic_year
  AND tr.academic_year_id IS NULL;

UPDATE app.term_registrations tr
SET term_id = t.id
FROM app.terms t
WHERE t.tenant_id = tr.tenant_id
  AND t.name      = tr.term
  AND tr.term_id  IS NULL;

-- migrate:down
DROP INDEX IF EXISTS app.term_registrations_academic_year_id_idx;
DROP INDEX IF EXISTS app.term_registrations_term_id_idx;
ALTER TABLE app.term_registrations
  DROP COLUMN IF EXISTS term_id,
  DROP COLUMN IF EXISTS academic_year_id;
