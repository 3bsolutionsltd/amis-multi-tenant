-- migrate:up

-- Staff profiles (SR-F-017, SR-F-019)
CREATE TABLE app.staff_profiles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_number    text,
  first_name      text        NOT NULL,
  last_name       text        NOT NULL,
  email           text,
  phone           text,
  department      text,
  designation     text,
  employment_type text        CHECK (employment_type IN ('full_time','part_time','contract','temporary')),
  join_date       date,
  salary          numeric(12,2),
  is_active       boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, staff_number)
);

ALTER TABLE app.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_profiles_tenant ON app.staff_profiles
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Staff contracts (SR-F-017)
CREATE TABLE app.staff_contracts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_id        uuid        NOT NULL REFERENCES app.staff_profiles(id) ON DELETE CASCADE,
  contract_type   text        NOT NULL,
  start_date      date        NOT NULL,
  end_date        date,
  salary          numeric(12,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.staff_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_contracts_tenant ON app.staff_contracts
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Staff attendance (SR-F-018 — instructor attendance visibility)
CREATE TABLE app.staff_attendance (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_id        uuid        NOT NULL REFERENCES app.staff_profiles(id) ON DELETE CASCADE,
  attendance_date date        NOT NULL,
  session         text        NOT NULL DEFAULT 'full' CHECK (session IN ('full','am','pm')),
  status          text        NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_id, attendance_date, session)
);

ALTER TABLE app.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_attendance_tenant ON app.staff_attendance
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Staff appraisals (SR-F-017)
CREATE TABLE app.staff_appraisals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_id        uuid        NOT NULL REFERENCES app.staff_profiles(id) ON DELETE CASCADE,
  period          text        NOT NULL,
  rating          integer     CHECK (rating BETWEEN 1 AND 5),
  comments        text,
  appraised_by    text,
  appraised_at    timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.staff_appraisals ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_appraisals_tenant ON app.staff_appraisals
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- migrate:down
DROP TABLE IF EXISTS app.staff_appraisals;
DROP TABLE IF EXISTS app.staff_attendance;
DROP TABLE IF EXISTS app.staff_contracts;
DROP TABLE IF EXISTS app.staff_profiles;
