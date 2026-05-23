-- migrate:up
-- Issue #174: Public portal POST /public/:slug/apply uses a `source` column
-- that did not exist, causing every online application to fail with a DB error.
-- Add the column with default 'manual' so existing staff-created rows keep the
-- correct value and the public portal can write 'online'.
ALTER TABLE app.admission_applications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- migrate:down
ALTER TABLE app.admission_applications
  DROP COLUMN IF EXISTS source;
