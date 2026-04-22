-- migrate:up

-- ============================================================
-- Academic Years
-- ============================================================
CREATE TABLE app.academic_years (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL,           -- e.g. '2025/2026'
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  is_current  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_dates_check CHECK (end_date > start_date)
);

CREATE INDEX academic_years_tenant_idx ON app.academic_years (tenant_id);

-- Only one current academic year per tenant
CREATE UNIQUE INDEX academic_years_tenant_current_idx
  ON app.academic_years (tenant_id) WHERE is_current = true;

ALTER TABLE app.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.academic_years FORCE ROW LEVEL SECURITY;

CREATE POLICY academic_years_tenant_isolation ON app.academic_years
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.academic_years TO amis_app;

-- ============================================================
-- Terms (semesters within an academic year)
-- ============================================================
CREATE TABLE app.terms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  academic_year_id uuid        NOT NULL REFERENCES app.academic_years(id) ON DELETE CASCADE,
  name             text        NOT NULL,      -- e.g. 'Term 1', 'Semester 2'
  term_number      smallint    NOT NULL,      -- 1, 2, 3
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  is_current       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terms_dates_check CHECK (end_date > start_date),
  CONSTRAINT terms_number_positive CHECK (term_number > 0)
);

CREATE INDEX terms_tenant_idx ON app.terms (tenant_id);
CREATE INDEX terms_academic_year_idx ON app.terms (academic_year_id);

-- Only one current term per tenant
CREATE UNIQUE INDEX terms_tenant_current_idx
  ON app.terms (tenant_id) WHERE is_current = true;

-- Unique term number within an academic year
CREATE UNIQUE INDEX terms_year_number_idx
  ON app.terms (academic_year_id, term_number);

ALTER TABLE app.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.terms FORCE ROW LEVEL SECURITY;

CREATE POLICY terms_tenant_isolation ON app.terms
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.terms TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS terms_tenant_isolation ON app.terms;
DROP TABLE IF EXISTS app.terms;

DROP POLICY IF EXISTS academic_years_tenant_isolation ON app.academic_years;
DROP TABLE IF EXISTS app.academic_years;
