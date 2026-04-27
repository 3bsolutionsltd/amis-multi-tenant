-- migrate:up

-- -----------------------------------------------------------------------
-- Priority 2: Annual Stock Take module
-- Based on interview with Odongo James (Asst Inventory Mgt Officer)
-- Stock take happens once a year (before June financial close).
-- Physical count is done per department; variance = counted - expected.
-- -----------------------------------------------------------------------

CREATE TABLE app.stock_takes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  reference       text        NOT NULL,           -- e.g. ST-2025/2026
  title           text,
  financial_year  text,                           -- e.g. "2025/2026"
  take_date       date        NOT NULL DEFAULT CURRENT_DATE,
  status          text        NOT NULL DEFAULT 'in_progress'
                              CHECK (status IN ('in_progress','completed','approved')),
  conducted_by    text,
  approved_by     text,
  approved_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);

ALTER TABLE app.stock_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_takes_tenant ON app.stock_takes
  FOR ALL USING (tenant_id = app.current_tenant_id());

CREATE TABLE app.stock_take_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid          NOT NULL REFERENCES platform.tenants(id),
  stock_take_id   uuid          NOT NULL REFERENCES app.stock_takes(id) ON DELETE CASCADE,
  item_id         uuid          NOT NULL REFERENCES app.inventory_items(id),
  department      text,                           -- which department's copy is being checked
  expected_qty    numeric(12,3) NOT NULL DEFAULT 0,
  counted_qty     numeric(12,3),                  -- NULL = not yet counted
  condition       text,
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE app.stock_take_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_take_items_tenant ON app.stock_take_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

CREATE INDEX stock_takes_tenant_status ON app.stock_takes (tenant_id, status);
CREATE INDEX stock_take_items_take ON app.stock_take_items (stock_take_id, item_id);

-- -----------------------------------------------------------------------
-- Priority 3: Add department field to store issuances
-- Departments request items from stores; we need to track which dept
-- -----------------------------------------------------------------------

ALTER TABLE app.store_issuances
  ADD COLUMN IF NOT EXISTS department text;

-- migrate:down

ALTER TABLE app.store_issuances
  DROP COLUMN IF EXISTS department;

DROP TABLE IF EXISTS app.stock_take_items;
DROP TABLE IF EXISTS app.stock_takes;
