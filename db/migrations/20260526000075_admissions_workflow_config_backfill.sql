-- migrate:up

-- Ensure every published tenant config has the current admissions workflow.
-- Some tenants had no payload.workflows.admissions entry, causing the API to
-- fall back to the old built-in submitted/shortlisted/interview workflow.
UPDATE platform.config_versions
SET payload = jsonb_set(
  jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{workflows}',
    COALESCE(payload->'workflows', '{}'::jsonb),
    true
  ),
  '{workflows,admissions}',
  '{
    "key": "admissions",
    "initial_state": "ADMITTED",
    "states": [
      "ADMITTED",
      "REPORTED",
      "FEE_CLEARED",
      "REGISTERED",
      "ENROLLED",
      "WITHDRAWN"
    ],
    "transitions": [
      {
        "action": "report_in",
        "from": "ADMITTED",
        "to": "REPORTED",
        "roles": ["registrar", "admin"],
        "label": "Mark as Reported"
      },
      {
        "action": "clear_fees",
        "from": "REPORTED",
        "to": "FEE_CLEARED",
        "roles": ["finance", "admin"],
        "label": "Clear Fees"
      },
      {
        "action": "register",
        "from": "FEE_CLEARED",
        "to": "REGISTERED",
        "roles": ["registrar", "admin"],
        "label": "Issue ID & Register"
      },
      {
        "action": "enroll",
        "from": "REGISTERED",
        "to": "ENROLLED",
        "roles": ["registrar", "admin"],
        "label": "Enrol as Student"
      },
      {
        "action": "withdraw",
        "from": "ADMITTED",
        "to": "WITHDRAWN",
        "roles": ["registrar", "admin"],
        "label": "Withdraw"
      },
      {
        "action": "withdraw",
        "from": "REPORTED",
        "to": "WITHDRAWN",
        "roles": ["registrar", "admin"],
        "label": "Withdraw"
      },
      {
        "action": "withdraw",
        "from": "FEE_CLEARED",
        "to": "WITHDRAWN",
        "roles": ["registrar", "admin"],
        "label": "Withdraw"
      }
    ]
  }'::jsonb,
  true
)
WHERE status = 'published';

-- Normalize any admissions created after the earlier workflow migration while
-- the API was still using the old built-in fallback workflow.
UPDATE app.workflow_instances
SET current_state = CASE current_state
  WHEN 'submitted'   THEN 'ADMITTED'
  WHEN 'shortlisted' THEN 'ADMITTED'
  WHEN 'interview'   THEN 'REPORTED'
  WHEN 'accepted'    THEN 'REGISTERED'
  WHEN 'admitted'    THEN 'REGISTERED'
  WHEN 'rejected'    THEN 'WITHDRAWN'
  ELSE current_state
END
WHERE workflow_key = 'admissions'
  AND current_state IN ('submitted','shortlisted','interview','accepted','admitted','rejected');

-- migrate:down
-- Not reversible without losing workflow history.
