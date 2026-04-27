-- migrate:up

-- Add 'procurement_officer' and 'inventory_manager' to the role check constraint.
ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal', 'dean', 'platform_admin',
      'procurement_officer', 'inventory_manager'
    ));

-- migrate:down

ALTER TABLE platform.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE platform.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'registrar', 'hod', 'instructor',
      'finance', 'principal', 'dean', 'platform_admin'
    ));
