-- migrate:up

-- Evidence file attachments for mark entries (stored as JSON array of {url, name, type})
ALTER TABLE app.mark_entries
  ADD COLUMN IF NOT EXISTS evidence_files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- migrate:down

ALTER TABLE app.mark_entries DROP COLUMN IF EXISTS evidence_files;
