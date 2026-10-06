-- migrate:up

-- Restore the original normalized RBAC assignment model while retaining
-- platform.users.role as the primary/backward-compatible role.
CREATE TABLE IF NOT EXISTS platform.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS platform.user_roles (
  user_id     uuid NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES platform.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON platform.user_roles(role_id);

-- Every existing primary role becomes an assigned role during the transition.
INSERT INTO platform.roles (tenant_id, name)
SELECT DISTINCT tenant_id, role
FROM platform.users
WHERE tenant_id IS NOT NULL
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO platform.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM platform.users u
JOIN platform.roles r ON r.tenant_id = u.tenant_id AND r.name = u.role
WHERE u.tenant_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- migrate:down
-- The RBAC tables are also part of the original platform schema. They must
-- remain available when this compatibility/backfill migration is rolled back.
SELECT 1;
