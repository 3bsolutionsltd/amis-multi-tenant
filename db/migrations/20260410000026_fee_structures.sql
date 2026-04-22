-- migrate:up

-- ============================================================
-- Fee Structures (fee schedules per programme, academic year, term)
-- ============================================================
CREATE TABLE app.fee_structures (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  academic_year_id  uuid        NOT NULL REFERENCES app.academic_years(id) ON DELETE CASCADE,
  term_id           uuid        NULL REFERENCES app.terms(id) ON DELETE SET NULL,
  programme_id      uuid        NOT NULL REFERENCES app.programmes(id) ON DELETE CASCADE,
  fee_type          text        NOT NULL DEFAULT 'tuition'
                                CHECK (fee_type IN ('tuition', 'functional', 'examination', 'other')),
  description       text        NULL,
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency          text        NOT NULL DEFAULT 'UGX',
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fee_structures_tenant_idx ON app.fee_structures (tenant_id);
CREATE INDEX fee_structures_academic_year_idx ON app.fee_structures (academic_year_id);
CREATE INDEX fee_structures_programme_idx ON app.fee_structures (programme_id);

-- Unique fee per type per programme per academic_year per term (NULL term means year-level fee)
CREATE UNIQUE INDEX fee_structures_unique_idx
  ON app.fee_structures (tenant_id, academic_year_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid), programme_id, fee_type);

ALTER TABLE app.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fee_structures FORCE ROW LEVEL SECURITY;

CREATE POLICY fee_structures_tenant_isolation ON app.fee_structures
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.fee_structures TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS fee_structures_tenant_isolation ON app.fee_structures;
DROP TABLE IF EXISTS app.fee_structures;
