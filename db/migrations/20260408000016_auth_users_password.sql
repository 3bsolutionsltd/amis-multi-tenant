-- migrate:up

-- Add authentication columns to platform.users.
-- password_hash: scrypt-derived key stored as "salt_hex:dk_hex"
-- role: single app-level role for JWT payload (pilot simplification over RBAC join)
ALTER TABLE platform.users
  ADD COLUMN password_hash text NOT NULL DEFAULT '',
  ADD COLUMN role          text NOT NULL DEFAULT 'registrar';

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'registrar', 'hod', 'instructor', 'finance', 'principal'));

-- Remove the temporary defaults so future INSERT must supply both values.
ALTER TABLE platform.users
  ALTER COLUMN password_hash DROP DEFAULT,
  ALTER COLUMN role          DROP DEFAULT;

-- migrate:down

ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS role;
