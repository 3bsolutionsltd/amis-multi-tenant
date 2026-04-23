-- migrate:up
-- Payment import fields: receipt number, term, programme, fee type, name-match confidence
ALTER TABLE app.payments
  ADD COLUMN IF NOT EXISTS receipt_number    text,
  ADD COLUMN IF NOT EXISTS payment_date      date,
  ADD COLUMN IF NOT EXISTS term              text,
  ADD COLUMN IF NOT EXISTS fee_type          text,
  ADD COLUMN IF NOT EXISTS programme_code    text,
  ADD COLUMN IF NOT EXISTS sponsorship_type  text,
  ADD COLUMN IF NOT EXISTS match_confidence  numeric(4,3);  -- 0.0–1.0, fuzzy-match score for name-only links

-- migrate:down
ALTER TABLE app.payments
  DROP COLUMN IF EXISTS receipt_number,
  DROP COLUMN IF EXISTS payment_date,
  DROP COLUMN IF EXISTS term,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS programme_code,
  DROP COLUMN IF EXISTS sponsorship_type,
  DROP COLUMN IF EXISTS match_confidence;
