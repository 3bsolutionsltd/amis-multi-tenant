-- migrate:up

-- Add Vote/Item column to PR line items (from the physical Internal Requisition Form)
-- This is a budget vote/item code used in Ugandan public institutions
ALTER TABLE app.purchase_requisition_items
  ADD COLUMN IF NOT EXISTS vote_item text;

-- Add Requisition No. to Goods Issue Notes (store_issuances)
-- The physical Goods Issue Note form has a "REQUISITION NO." field
-- linking the issue to the originating internal requisition
ALTER TABLE app.store_issuances
  ADD COLUMN IF NOT EXISTS requisition_ref text;

-- migrate:down

ALTER TABLE app.purchase_requisition_items DROP COLUMN IF EXISTS vote_item;
ALTER TABLE app.store_issuances DROP COLUMN IF EXISTS requisition_ref;
