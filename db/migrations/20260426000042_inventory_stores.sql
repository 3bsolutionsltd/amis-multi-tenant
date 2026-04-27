-- migrate:up

-- -----------------------------------------------------------------------
-- Inventory / Stores Module
-- Requested by Kyema — item catalog, stock levels, transactions, issuances
-- -----------------------------------------------------------------------

-- Item catalog
CREATE TABLE app.inventory_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  item_code       text,
  name            text        NOT NULL,
  description     text,
  category        text        NOT NULL DEFAULT 'other'
                              CHECK (category IN (
                                'stationery','furniture','equipment','laboratory',
                                'cleaning','food','uniform','medical','other'
                              )),
  unit_of_measure text        NOT NULL DEFAULT 'units',
  reorder_level   numeric(12,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  current_stock   numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost       numeric(15,2),
  is_active       boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, item_code)
);

ALTER TABLE app.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_tenant ON app.inventory_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Stock transactions — every movement in or out is recorded here
CREATE TABLE app.stock_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES platform.tenants(id),
  item_id          uuid        NOT NULL REFERENCES app.inventory_items(id),
  transaction_type text        NOT NULL
                               CHECK (transaction_type IN ('receipt','issuance','adjustment','return')),
  -- Positive = stock in (receipt/return), Negative = stock out (issuance)
  quantity         numeric(12,3) NOT NULL,
  balance_after    numeric(12,3) NOT NULL,
  -- Optional linkage to a GRN or issuance document
  reference_type   text        CHECK (reference_type IN ('grn','issuance','manual')),
  reference_id     uuid,
  performed_by     text,
  transaction_date date        NOT NULL DEFAULT CURRENT_DATE,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_transactions_tenant ON app.stock_transactions
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Trigger: keep inventory_items.current_stock in sync after every transaction
CREATE OR REPLACE FUNCTION app.update_item_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE app.inventory_items
  SET current_stock = NEW.balance_after,
      updated_at    = now()
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_item_stock
  AFTER INSERT ON app.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION app.update_item_stock();

-- Store issuance documents
CREATE TABLE app.store_issuances (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES platform.tenants(id),
  issuance_number  text        NOT NULL,
  issued_to        text        NOT NULL,   -- department or person name
  issued_by        text,
  purpose          text,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','issued','returned')),
  issue_date       date        NOT NULL DEFAULT CURRENT_DATE,
  return_date      date,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issuance_number)
);

ALTER TABLE app.store_issuances ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_issuances_tenant ON app.store_issuances
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Store issuance line items
CREATE TABLE app.store_issuance_items (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES platform.tenants(id),
  issuance_id        uuid        NOT NULL REFERENCES app.store_issuances(id) ON DELETE CASCADE,
  item_id            uuid        NOT NULL REFERENCES app.inventory_items(id),
  quantity_requested numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  quantity_issued    numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity_issued >= 0),
  quantity_returned  numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity_returned >= 0),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.store_issuance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_issuance_items_tenant ON app.store_issuance_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Indexes
CREATE INDEX inventory_items_tenant_category ON app.inventory_items (tenant_id, category);
CREATE INDEX inventory_items_low_stock ON app.inventory_items (tenant_id, current_stock)
  WHERE current_stock <= reorder_level;
CREATE INDEX stock_transactions_item ON app.stock_transactions (item_id, transaction_date DESC);
CREATE INDEX store_issuances_tenant_status ON app.store_issuances (tenant_id, status);

-- migrate:down

DROP TRIGGER IF EXISTS trg_update_item_stock ON app.stock_transactions;
DROP FUNCTION IF EXISTS app.update_item_stock();
DROP TABLE IF EXISTS app.store_issuance_items;
DROP TABLE IF EXISTS app.store_issuances;
DROP TABLE IF EXISTS app.stock_transactions;
DROP TABLE IF EXISTS app.inventory_items;
