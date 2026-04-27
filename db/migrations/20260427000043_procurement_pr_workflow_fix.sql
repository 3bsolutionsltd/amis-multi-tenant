-- migrate:up

-- -----------------------------------------------------------------------
-- Priority 1: Fix Purchase Requisition workflow to match KTI process
-- Based on interview with Achola (Procurement Officer)
-- Real flow: draft → submitted → hod_recommended → principal_approved → ordered/rejected → closed
-- Also adds audit fields: recommended_by, recommended_at, approved_by, approved_at
-- -----------------------------------------------------------------------

-- Add audit columns
ALTER TABLE app.purchase_requisitions
  ADD COLUMN IF NOT EXISTS recommended_by  text,
  ADD COLUMN IF NOT EXISTS recommended_at  timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by     text,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz;

-- Drop old CHECK constraint and add new one with the two new states
ALTER TABLE app.purchase_requisitions
  DROP CONSTRAINT IF EXISTS purchase_requisitions_status_check;

ALTER TABLE app.purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_status_check
    CHECK (status IN (
      'draft',
      'submitted',
      'hod_recommended',
      'principal_approved',
      'rejected',
      'ordered',
      'closed'
    ));

-- migrate:down

ALTER TABLE app.purchase_requisitions
  DROP CONSTRAINT IF EXISTS purchase_requisitions_status_check;

ALTER TABLE app.purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_status_check
    CHECK (status IN ('draft','submitted','approved','rejected','ordered','closed'));

ALTER TABLE app.purchase_requisitions
  DROP COLUMN IF EXISTS recommended_by,
  DROP COLUMN IF EXISTS recommended_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;
