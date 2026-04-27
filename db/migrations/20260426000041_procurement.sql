-- migrate:up

-- -----------------------------------------------------------------------
-- Procurement Module
-- Requested by Kyema — covers Suppliers, Purchase Requisitions,
-- Purchase Orders, and Goods Received Notes.
-- -----------------------------------------------------------------------

-- Suppliers
CREATE TABLE app.suppliers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  name            text        NOT NULL,
  contact_person  text,
  email           text,
  phone           text,
  address         text,
  tin_number      text,
  is_active       boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, name)
);

ALTER TABLE app.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_tenant ON app.suppliers
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Purchase Requisitions (PRs)
CREATE TABLE app.purchase_requisitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  pr_number       text        NOT NULL,
  title           text        NOT NULL,
  department      text,
  requested_by    text,
  priority        text        NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('low','normal','high','urgent')),
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','submitted','approved','rejected','ordered','closed')),
  academic_year   text,
  required_by     date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pr_number)
);

ALTER TABLE app.purchase_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_requisitions_tenant ON app.purchase_requisitions
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Purchase Requisition line items
CREATE TABLE app.purchase_requisition_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  pr_id           uuid        NOT NULL REFERENCES app.purchase_requisitions(id) ON DELETE CASCADE,
  description     text        NOT NULL,
  quantity        numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit            text        NOT NULL DEFAULT 'units',
  estimated_unit_cost numeric(15,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.purchase_requisition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_items_tenant ON app.purchase_requisition_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Purchase Orders (POs)
CREATE TABLE app.purchase_orders (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES platform.tenants(id),
  po_number              text        NOT NULL,
  pr_id                  uuid        REFERENCES app.purchase_requisitions(id),
  supplier_id            uuid        REFERENCES app.suppliers(id),
  title                  text        NOT NULL,
  status                 text        NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft','issued','partial_received','received','closed','cancelled')),
  order_date             date        NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  total_amount           numeric(15,2),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, po_number)
);

ALTER TABLE app.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_tenant ON app.purchase_orders
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Purchase Order line items
CREATE TABLE app.purchase_order_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  po_id           uuid        NOT NULL REFERENCES app.purchase_orders(id) ON DELETE CASCADE,
  description     text        NOT NULL,
  quantity        numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit            text        NOT NULL DEFAULT 'units',
  unit_price      numeric(15,2) NOT NULL DEFAULT 0,
  total_price     numeric(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_items_tenant ON app.purchase_order_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Goods Received Notes (GRNs)
CREATE TABLE app.goods_received_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  grn_number      text        NOT NULL,
  po_id           uuid        REFERENCES app.purchase_orders(id),
  received_by     text,
  received_date   date        NOT NULL DEFAULT CURRENT_DATE,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','confirmed')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, grn_number)
);

ALTER TABLE app.goods_received_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY grn_tenant ON app.goods_received_notes
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- GRN line items
CREATE TABLE app.grn_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES platform.tenants(id),
  grn_id              uuid        NOT NULL REFERENCES app.goods_received_notes(id) ON DELETE CASCADE,
  po_item_id          uuid        REFERENCES app.purchase_order_items(id),
  description         text        NOT NULL,
  quantity_ordered    numeric(12,3),
  quantity_received   numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  condition           text        NOT NULL DEFAULT 'good'
                                  CHECK (condition IN ('good','damaged','missing')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.grn_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY grn_items_tenant ON app.grn_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Indexes
CREATE INDEX procurement_prs_tenant_status ON app.purchase_requisitions (tenant_id, status);
CREATE INDEX procurement_pos_tenant_status ON app.purchase_orders (tenant_id, status);
CREATE INDEX procurement_grns_tenant ON app.goods_received_notes (tenant_id, received_date DESC);

-- migrate:down

DROP TABLE IF EXISTS app.grn_items;
DROP TABLE IF EXISTS app.goods_received_notes;
DROP TABLE IF EXISTS app.purchase_order_items;
DROP TABLE IF EXISTS app.purchase_orders;
DROP TABLE IF EXISTS app.purchase_requisition_items;
DROP TABLE IF EXISTS app.purchase_requisitions;
DROP TABLE IF EXISTS app.suppliers;
