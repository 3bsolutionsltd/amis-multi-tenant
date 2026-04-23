-- migrate:up
-- TVET Act & CoVE Framework — schema gap additions
-- Derived from tvet_cove_act.docx analysis (GAP-T1 through GAP-T5)

-- GAP-T1: Student fields required by TVET Act / CoVE
ALTER TABLE app.students
  ADD COLUMN IF NOT EXISTS admission_date        date,
  ADD COLUMN IF NOT EXISTS entry_qualification   text,
  ADD COLUMN IF NOT EXISTS uvtab_reg_number      text,
  ADD COLUMN IF NOT EXISTS completion_date       date,
  ADD COLUMN IF NOT EXISTS non_cert_reason       text;

-- GAP-T2: Programme fields
ALTER TABLE app.programmes
  ADD COLUMN IF NOT EXISTS accreditation_status  text  CHECK (accreditation_status IN ('accredited','pending','withdrawn','not_applicable')),
  ADD COLUMN IF NOT EXISTS intake_capacity       int   CHECK (intake_capacity > 0),
  ADD COLUMN IF NOT EXISTS mode                  text  CHECK (mode IN ('formal','nonformal')),
  ADD COLUMN IF NOT EXISTS awarding_body         text;

-- GAP-T3: Tenant (institution) licensing fields
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS license_number        text,
  ADD COLUMN IF NOT EXISTS license_date          date,
  ADD COLUMN IF NOT EXISTS license_status        text  CHECK (license_status IN ('active','expired','suspended','pending')),
  ADD COLUMN IF NOT EXISTS ownership_type        text  CHECK (ownership_type IN ('public','private','faith_based','community'));

-- GAP-T4: Staff qualification & licensing fields (TVET Act requires registration + licence)
ALTER TABLE app.staff_profiles
  ADD COLUMN IF NOT EXISTS qualification_level          text,
  ADD COLUMN IF NOT EXISTS vocational_cert              text,
  ADD COLUMN IF NOT EXISTS pedagogy_trained             boolean,
  ADD COLUMN IF NOT EXISTS trainer_reg_number           text,
  ADD COLUMN IF NOT EXISTS license_number               text,
  ADD COLUMN IF NOT EXISTS license_expiry               date,
  ADD COLUMN IF NOT EXISTS industrial_experience_years  int;

-- GAP-T5: CPD (Continuing Professional Development) table for trainers
CREATE TABLE IF NOT EXISTS app.staff_cpd (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  staff_id        uuid        NOT NULL REFERENCES app.staff_profiles(id) ON DELETE CASCADE,
  training_name   text        NOT NULL,
  provider        text,
  start_date      date        NOT NULL,
  end_date        date,
  duration_hours  numeric(6,1),
  certificate_ref text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.staff_cpd ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_cpd_tenant ON app.staff_cpd
  FOR ALL USING (tenant_id = app.current_tenant_id());

CREATE INDEX staff_cpd_staff_id_idx ON app.staff_cpd (staff_id);

-- migrate:down
ALTER TABLE app.students
  DROP COLUMN IF EXISTS admission_date,
  DROP COLUMN IF EXISTS entry_qualification,
  DROP COLUMN IF EXISTS uvtab_reg_number,
  DROP COLUMN IF EXISTS completion_date,
  DROP COLUMN IF EXISTS non_cert_reason;

ALTER TABLE app.programmes
  DROP COLUMN IF EXISTS accreditation_status,
  DROP COLUMN IF EXISTS intake_capacity,
  DROP COLUMN IF EXISTS mode,
  DROP COLUMN IF EXISTS awarding_body;

ALTER TABLE platform.tenants
  DROP COLUMN IF EXISTS license_number,
  DROP COLUMN IF EXISTS license_date,
  DROP COLUMN IF EXISTS license_status,
  DROP COLUMN IF EXISTS ownership_type;

ALTER TABLE app.staff_profiles
  DROP COLUMN IF EXISTS qualification_level,
  DROP COLUMN IF EXISTS vocational_cert,
  DROP COLUMN IF EXISTS pedagogy_trained,
  DROP COLUMN IF EXISTS trainer_reg_number,
  DROP COLUMN IF EXISTS license_number,
  DROP COLUMN IF EXISTS license_expiry,
  DROP COLUMN IF EXISTS industrial_experience_years;

DROP TABLE IF EXISTS app.staff_cpd;
