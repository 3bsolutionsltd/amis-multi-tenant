-- migrate:up

-- Ensure every published tenant config has the marks workflow.
-- Issue #204: Marks - New Mark Submission returns API error 422
-- Some tenants had no payload.workflows.marks entry, causing the API to
-- return 422 "workflow marks not found in published config" on submission creation.
UPDATE platform.config_versions
SET payload = jsonb_set(
  jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{workflows}',
    COALESCE(payload->'workflows', '{}'::jsonb),
    true
  ),
  '{workflows,marks}',
  '{
    "key": "marks",
    "initial_state": "DRAFT",
    "states": [
      "DRAFT",
      "SUBMITTED",
      "HOD_REVIEW",
      "APPROVED",
      "PUBLISHED"
    ],
    "transitions": [
      {
        "action": "submit",
        "from": "DRAFT",
        "to": "SUBMITTED",
        "roles": ["instructor", "admin"],
        "label": "Submit for Review"
      },
      {
        "action": "review",
        "from": "SUBMITTED",
        "to": "HOD_REVIEW",
        "roles": ["hod", "admin"],
        "label": "Review"
      },
      {
        "action": "approve",
        "from": "HOD_REVIEW",
        "to": "APPROVED",
        "roles": ["hod", "admin"],
        "label": "Approve"
      },
      {
        "action": "return",
        "from": "HOD_REVIEW",
        "to": "DRAFT",
        "roles": ["hod", "admin"],
        "label": "Return to Draft"
      },
      {
        "action": "publish",
        "from": "APPROVED",
        "to": "PUBLISHED",
        "roles": ["registrar", "admin"],
        "label": "Publish"
      }
    ]
  }'::jsonb,
  true
)
WHERE status = 'published';

-- migrate:down
-- Not reversible without losing workflow history.
