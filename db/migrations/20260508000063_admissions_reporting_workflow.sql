-- migrate:up

-- Replace the admissions workflow in all published tenant configs
-- with the TVET reporting-day pipeline:
--   ADMITTED → REPORTED → FEE_CLEARED → REGISTERED → ENROLLED
--   + WITHDRAWN (from ADMITTED, REPORTED, or FEE_CLEARED)
--
-- Role-gated transitions:
--   report_in  → registrar, admin      (reception desk)
--   clear_fees → finance, admin        (bursar desk)
--   register   → registrar, admin      (ICT / admin desk)
--   enroll     → registrar, admin      (final enrolment)
--   withdraw   → registrar, admin      (dropout handling)
--
-- Also migrates any existing workflow_instances that still carry
-- the old state names (submitted/shortlisted/interview/accepted/rejected)
-- to their closest equivalent in the new model.

-- ─── 1. Patch published config_versions for every tenant ──────────────────
UPDATE platform.config_versions
SET payload = jsonb_set(
  payload,
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
WHERE status = 'published'
  AND payload -> 'workflows' ? 'admissions';

-- ─── 2. Migrate existing admissions workflow_instances ────────────────────
-- Map old competitive-admissions states → new reporting-day states.
-- "submitted"   → ADMITTED   (uploaded but not yet reported)
-- "shortlisted" → ADMITTED   (not yet physically present)
-- "interview"   → REPORTED   (closest: they showed up for interview)
-- "accepted"    → REGISTERED (accepted = cleared to register)
-- "rejected"    → WITHDRAWN
UPDATE app.workflow_instances
SET current_state = CASE current_state
  WHEN 'submitted'   THEN 'ADMITTED'
  WHEN 'shortlisted' THEN 'ADMITTED'
  WHEN 'interview'   THEN 'REPORTED'
  WHEN 'accepted'    THEN 'REGISTERED'
  WHEN 'rejected'    THEN 'WITHDRAWN'
  ELSE current_state   -- ADMITTED/REPORTED/FEE_CLEARED/REGISTERED/ENROLLED/WITHDRAWN already correct
END
WHERE workflow_key = 'admissions'
  AND current_state IN ('submitted','shortlisted','interview','accepted','rejected');

-- ─── 3. Backfill workflow_events for migrated instances ───────────────────
-- Insert a single "migration" event so the audit trail is honest.
INSERT INTO app.workflow_events
  (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
SELECT
  wi.tenant_id,
  wi.entity_type,
  wi.entity_id,
  wi.workflow_key,
  '__legacy__',
  wi.current_state,
  '__migration_20260508__',
  NULL
FROM app.workflow_instances wi
WHERE wi.workflow_key = 'admissions'
  AND wi.current_state IN ('ADMITTED','REPORTED','REGISTERED','WITHDRAWN')
  AND NOT EXISTS (
    SELECT 1 FROM app.workflow_events we
    WHERE we.entity_id    = wi.entity_id
      AND we.workflow_key = 'admissions'
      AND we.action_key   = '__migration_20260508__'
  );

-- migrate:down
-- State rollback is not safe; intentionally left blank.
