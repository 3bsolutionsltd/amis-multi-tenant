-- migrate:up

-- =========================================================================
-- SR-F-011: Alumni table (graduated students)
-- =========================================================================

CREATE TABLE app.alumni (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  student_id      uuid        NOT NULL,
  first_name      text        NOT NULL,
  last_name       text        NOT NULL,
  programme       text,
  admission_number text,
  graduation_date date        NOT NULL,
  graduation_notes text,
  graduated_by    uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alumni_tenant_id_idx ON app.alumni (tenant_id);
CREATE INDEX alumni_student_id_idx ON app.alumni (student_id);

ALTER TABLE app.alumni ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.alumni
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- =========================================================================
-- SR-F-029: Add source column to admission_applications (online vs internal)
-- =========================================================================

ALTER TABLE app.admission_applications
  ADD COLUMN source text NOT NULL DEFAULT 'internal';

-- =========================================================================
-- SR-F-014: SchoolPay transactions for reconciliation
-- =========================================================================

CREATE TABLE app.schoolpay_transactions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  schoolpay_ref       text        NOT NULL,
  student_name        text,
  student_id_match    uuid,
  payment_id_match    uuid,
  amount              numeric     NOT NULL CHECK (amount > 0),
  currency            text        NOT NULL DEFAULT 'UGX',
  paid_at             timestamptz NOT NULL,
  raw_payload         jsonb       NOT NULL DEFAULT '{}',
  status              text        NOT NULL DEFAULT 'unmatched'
                      CHECK (status IN ('unmatched', 'matched', 'disputed')),
  matched_at          timestamptz,
  matched_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX schoolpay_txn_tenant_idx ON app.schoolpay_transactions (tenant_id);
CREATE INDEX schoolpay_txn_ref_idx ON app.schoolpay_transactions (schoolpay_ref);
CREATE INDEX schoolpay_txn_status_idx ON app.schoolpay_transactions (tenant_id, status);

ALTER TABLE app.schoolpay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.schoolpay_transactions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down

DROP TABLE IF EXISTS app.schoolpay_transactions;
ALTER TABLE app.admission_applications DROP COLUMN IF EXISTS source;
DROP TABLE IF EXISTS app.alumni;
