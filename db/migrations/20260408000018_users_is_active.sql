-- migrate:up

-- Add is_active flag to platform.users so tenant admins can disable accounts
-- without deleting them. Defaults to true for all existing and new users.
ALTER TABLE platform.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- migrate:down

ALTER TABLE platform.users DROP COLUMN IF EXISTS is_active;
