-- migrate:up

-- -----------------------------------------------------------------------
-- Store Requisitions (SRQ)
-- A formal request for items already held in stores.
-- HOD approves → Storekeeper fulfils via GIN, or escalates to Procurement (PR).
-- -----------------------------------------------------------------------

CREATE TABLE app.store_requisitions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES platform.tenants(id),
  srq_number          text        NOT NULL,
  requested_by        text        NOT NULL,
  department          text,
  purpose             text,
  required_date       date,
  -- Optional link to a student project (for RLP costing)
  student_project_id  uuid        REFERENCES app.student_projects(id),
  -- Optional link to course/term (for instructor bulk requests)
  course_id           uuid        REFERENCES app.courses(id),
  term_id             uuid        REFERENCES app.terms(id),
  -- Approval
  status              text        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN (
                                    'draft',
                                    'submitted',
                                    'hod_approved',
                                    'fulfilled',
                                    'rejected',
                                    'escalated_to_pr'
                                  )),
  hod_approved_by     text,
  hod_approved_at     timestamptz,
  rejection_reason    text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, srq_number)
);

ALTER TABLE app.store_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_requisitions_tenant ON app.store_requisitions
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- SRQ line items
CREATE TABLE app.store_requisition_items (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid          NOT NULL REFERENCES platform.tenants(id),
  srq_id              uuid          NOT NULL REFERENCES app.store_requisitions(id) ON DELETE CASCADE,
  -- Optional link to inventory catalog; free-text description if not catalogued
  item_id             uuid          REFERENCES app.inventory_items(id),
  description         text          NOT NULL,
  quantity_requested  numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  quantity_approved   numeric(12,3),
  unit                text          NOT NULL DEFAULT 'units',
  -- Snapshot of unit cost at time of approval
  unit_cost           numeric(15,2),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE app.store_requisition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_requisition_items_tenant ON app.store_requisition_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Indexes
CREATE INDEX store_requisitions_tenant_status ON app.store_requisitions (tenant_id, status);
CREATE INDEX store_requisitions_project ON app.store_requisitions (student_project_id) WHERE student_project_id IS NOT NULL;
CREATE INDEX store_requisition_items_srq ON app.store_requisition_items (srq_id);

GRANT SELECT, INSERT, UPDATE ON app.store_requisitions TO amis_app;
GRANT SELECT, INSERT, UPDATE ON app.store_requisition_items TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS app.store_requisition_items;
DROP TABLE IF EXISTS app.store_requisitions;
