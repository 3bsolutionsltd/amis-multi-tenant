-- migrate:up

CREATE TABLE platform.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,           -- e.g. "greenfield-vti"
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- Minimal RBAC: roles and the joining table
CREATE TABLE platform.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,                  -- e.g. "admin", "teacher", "student"
  UNIQUE (tenant_id, name)
);

CREATE TABLE platform.user_roles (
  user_id     uuid NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES platform.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- migrate:down

DROP TABLE IF EXISTS platform.user_roles;
DROP TABLE IF EXISTS platform.roles;
DROP TABLE IF EXISTS platform.users;
DROP TABLE IF EXISTS platform.tenants;
