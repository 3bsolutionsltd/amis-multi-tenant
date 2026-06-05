-- migrate:up
-- Best-effort repair of student records created before programme validation
-- was enforced. Attempts to back-fill programme_id by matching the free-text
-- `programme` field against app.programmes on code or title (case-insensitive).
-- Unmatched rows are left untouched — they will trigger the fee-summary
-- warning added in the application layer so finance staff can spot them.

UPDATE app.students s
SET
  programme_id   = p.id,
  programme_code = p.code,
  programme      = p.title,
  updated_at     = now()
FROM app.programmes p
WHERE s.tenant_id = p.tenant_id
  AND s.programme_id IS NULL
  AND (
    lower(s.programme) = lower(p.code)
    OR lower(s.programme) = lower(p.title)
  );

-- migrate:down
-- This migration is data-only; a down migration cannot reliably reverse it.
-- Leave as no-op.
