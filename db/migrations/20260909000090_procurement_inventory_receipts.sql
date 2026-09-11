-- migrate:up

-- Link purchased goods to the catalog item that receives stock.
ALTER TABLE app.purchase_order_items
  ADD COLUMN inventory_item_id uuid REFERENCES app.inventory_items(id);

ALTER TABLE app.grn_items
  ADD COLUMN inventory_item_id uuid REFERENCES app.inventory_items(id);

-- A document reference may be an external number (for example GRN-2026-001),
-- so it must not be restricted to UUID values.
ALTER TABLE app.stock_transactions
  ALTER COLUMN reference_id TYPE text USING reference_id::text;

-- A GRN line can post at most one receipt transaction. This makes confirmation
-- safe to retry without duplicating stock.
CREATE UNIQUE INDEX stock_transactions_grn_reference
  ON app.stock_transactions (reference_type, reference_id)
  WHERE reference_type = 'grn' AND reference_id IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS app.stock_transactions_grn_reference;
ALTER TABLE app.stock_transactions ALTER COLUMN reference_id TYPE uuid USING NULLIF(reference_id, '')::uuid;
ALTER TABLE app.grn_items DROP COLUMN IF EXISTS inventory_item_id;
ALTER TABLE app.purchase_order_items DROP COLUMN IF EXISTS inventory_item_id;
