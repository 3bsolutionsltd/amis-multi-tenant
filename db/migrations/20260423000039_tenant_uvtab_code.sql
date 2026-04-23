-- migrate:up

-- TVET Act & CoVE framework require each VTI to record its UVTAB
-- examination centre code (e.g. UVT212 for Kasese TI). This is used
-- when generating exam entry lists and official result submissions.
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS uvtab_centre_code text;

-- migrate:down

ALTER TABLE platform.tenants
  DROP COLUMN IF EXISTS uvtab_centre_code;
