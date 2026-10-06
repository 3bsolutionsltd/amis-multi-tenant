-- migrate:up

CREATE TABLE app.master_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  asset_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  default_useful_life_years integer CHECK (default_useful_life_years IS NULL OR default_useful_life_years > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_code)
);

CREATE TABLE app.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  master_asset_id uuid NOT NULL REFERENCES app.master_assets(id),
  asset_tag text NOT NULL,
  serial_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','in_repair','disposed','lost','transferred')),
  acquisition_date date,
  acquisition_cost numeric(15,2) CHECK (acquisition_cost IS NULL OR acquisition_cost >= 0),
  location text,
  custody_department text,
  custody_holder text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_tag),
  UNIQUE NULLS NOT DISTINCT (tenant_id, serial_number)
);

ALTER TABLE app.master_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_assets_tenant ON app.master_assets FOR ALL USING (tenant_id = app.current_tenant_id());
CREATE POLICY assets_tenant ON app.assets FOR ALL USING (tenant_id = app.current_tenant_id());
CREATE INDEX master_assets_tenant_category ON app.master_assets (tenant_id, category);
CREATE INDEX assets_tenant_status ON app.assets (tenant_id, status);
CREATE INDEX assets_tenant_custody ON app.assets (tenant_id, custody_department, custody_holder);

-- migrate:down
DROP TABLE IF EXISTS app.assets;
DROP TABLE IF EXISTS app.master_assets;
