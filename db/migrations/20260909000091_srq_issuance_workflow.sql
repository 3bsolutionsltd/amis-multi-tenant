-- migrate:up

ALTER TABLE app.store_requisitions
  DROP CONSTRAINT IF EXISTS store_requisitions_status_check;

ALTER TABLE app.store_requisitions
  ADD CONSTRAINT store_requisitions_status_check
  CHECK (status IN (
    'draft', 'submitted', 'hod_approved', 'ready_for_issue',
    'fulfilled', 'rejected', 'escalated_to_pr'
  ));

-- migrate:down

ALTER TABLE app.store_requisitions
  DROP CONSTRAINT IF EXISTS store_requisitions_status_check;

ALTER TABLE app.store_requisitions
  ADD CONSTRAINT store_requisitions_status_check
  CHECK (status IN (
    'draft', 'submitted', 'hod_approved', 'fulfilled',
    'rejected', 'escalated_to_pr'
  ));
