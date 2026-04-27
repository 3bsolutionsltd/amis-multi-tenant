-- migrate:up
-- Add unique constraint so ON CONFLICT upsert works per item within a stock take
ALTER TABLE app.stock_take_items
  ADD CONSTRAINT stock_take_items_take_item_uniq UNIQUE (stock_take_id, item_id);

-- migrate:down
ALTER TABLE app.stock_take_items
  DROP CONSTRAINT IF EXISTS stock_take_items_take_item_uniq;
