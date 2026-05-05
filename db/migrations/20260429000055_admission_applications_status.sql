-- migrate:up
-- Issue #88: No formal status column on admission_applications.
-- Add a denormalised status column so applications can be filtered/displayed
-- without querying the workflow engine.

ALTER TABLE app.admission_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected', 'enrolled'));

CREATE INDEX IF NOT EXISTS admission_applications_status_idx
  ON app.admission_applications (tenant_id, status);

-- Back-fill: read current_state from workflow_instances where available.
-- If workflow state = 'APPROVED' → 'accepted', 'REJECTED' → 'rejected',
-- 'ENROLLED' → 'enrolled', 'REVIEW' → 'under_review', else stays 'submitted'.
UPDATE app.admission_applications aa
SET status = CASE wi.current_state
               WHEN 'APPROVED'  THEN 'accepted'
               WHEN 'REJECTED'  THEN 'rejected'
               WHEN 'ENROLLED'  THEN 'enrolled'
               WHEN 'REVIEW'    THEN 'under_review'
               ELSE 'submitted'
             END
FROM app.workflow_instances wi
WHERE wi.entity_type = 'admission'
  AND wi.entity_id   = aa.id;

-- migrate:down
DROP INDEX IF EXISTS app.admission_applications_status_idx;
ALTER TABLE app.admission_applications
  DROP COLUMN IF EXISTS status;
