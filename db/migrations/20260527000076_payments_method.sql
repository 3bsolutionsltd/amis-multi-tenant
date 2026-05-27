-- migrate:up

ALTER TABLE app.payments
  ADD COLUMN IF NOT EXISTS payment_method text;

-- migrate:down

ALTER TABLE app.payments
  DROP COLUMN IF EXISTS payment_method;