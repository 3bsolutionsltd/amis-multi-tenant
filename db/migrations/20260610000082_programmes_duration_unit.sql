-- migrate:up
ALTER TABLE app.programmes
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'months'
  CHECK (duration_unit IN ('months', 'years'));

-- migrate:down
ALTER TABLE app.programmes DROP COLUMN IF EXISTS duration_unit;
