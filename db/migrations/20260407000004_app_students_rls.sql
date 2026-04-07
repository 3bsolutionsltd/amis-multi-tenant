-- migrate:up

CREATE TABLE app.students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  date_of_birth date,
  gender      text CHECK (gender IN ('male', 'female', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for all tenant-scoped queries
CREATE INDEX students_tenant_id_idx ON app.students (tenant_id);

-- Enable Row-Level Security
ALTER TABLE app.students ENABLE ROW LEVEL SECURITY;

-- Tenants may only see their own students.
-- The API sets app.tenant_id per transaction before any query.
CREATE POLICY students_tenant_isolation
  ON app.students
  USING (tenant_id = app.current_tenant_id());

-- migrate:down

DROP TABLE IF EXISTS app.students;
