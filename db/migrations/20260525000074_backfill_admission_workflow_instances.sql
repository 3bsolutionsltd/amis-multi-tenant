-- migrate:up

-- Backfill workflow_instances for admission_applications that have none.
-- These are applications that were inserted directly into the DB (bypassing
-- the API route that normally creates a workflow_instance atomically), or
-- were created before the workflow engine was wired in.
-- We set them to ADMITTED — the initial state of the reporting-day workflow.

INSERT INTO app.workflow_instances
  (tenant_id, entity_type, entity_id, workflow_key, current_state)
SELECT
  a.tenant_id,
  'admissions',
  a.id,
  'admissions',
  'ADMITTED'
FROM app.admission_applications a
WHERE NOT EXISTS (
  SELECT 1
  FROM app.workflow_instances wi
  WHERE wi.entity_type = 'admissions'
    AND wi.entity_id = a.id
);

-- Write a synthetic audit event for each row we just inserted.
INSERT INTO app.workflow_events
  (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
SELECT
  wi.tenant_id,
  wi.entity_type,
  wi.entity_id,
  wi.workflow_key,
  NULL,
  wi.current_state,
  '__backfill_20260525__',
  NULL
FROM app.workflow_instances wi
WHERE wi.workflow_key = 'admissions'
  AND NOT EXISTS (
    SELECT 1
    FROM app.workflow_events we
    WHERE we.entity_id = wi.entity_id
      AND we.workflow_key = 'admissions'
  );

-- migrate:down
-- Intentionally left blank — do not delete application workflow state.
