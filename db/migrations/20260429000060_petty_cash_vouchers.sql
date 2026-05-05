-- migrate:up

-- -----------------------------------------------------------------------
-- Petty Cash Vouchers (PCV)
-- Requests for cash to purchase items externally (not from stores).
-- Approval chain: draft → submitted → hod_approved → bursar_approved → paid → retired
-- Retired by attaching a receipt reference.
-- -----------------------------------------------------------------------

CREATE TABLE app.petty_cash_vouchers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES platform.tenants(id),
  pcv_number          text        NOT NULL,
  requested_by        text        NOT NULL,
  department          text,
  purpose             text        NOT NULL,
  amount_requested    numeric(15,2) NOT NULL CHECK (amount_requested > 0),
  amount_approved     numeric(15,2),
  amount_paid         numeric(15,2),
  payment_method      text        CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer')),
  status              text        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN (
                                    'draft',
                                    'submitted',
                                    'hod_approved',
                                    'bursar_approved',
                                    'paid',
                                    'retired',
                                    'rejected'
                                  )),
  -- HOD approval
  hod_approved_by     text,
  hod_approved_at     timestamptz,
  -- Bursar / finance approval
  bursar_approved_by  text,
  bursar_approved_at  timestamptz,
  -- Payment
  paid_by             text,
  paid_at             timestamptz,
  -- Retirement (receipt attached)
  receipt_ref         text,
  receipt_date        date,
  retired_at          timestamptz,
  -- Rejection
  rejection_reason    text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pcv_number)
);

ALTER TABLE app.petty_cash_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY petty_cash_vouchers_tenant ON app.petty_cash_vouchers
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- PCV line items — what the cash will be spent on
CREATE TABLE app.petty_cash_voucher_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid          NOT NULL REFERENCES platform.tenants(id),
  pcv_id      uuid          NOT NULL REFERENCES app.petty_cash_vouchers(id) ON DELETE CASCADE,
  description text          NOT NULL,
  quantity    numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit        text          NOT NULL DEFAULT 'units',
  unit_cost   numeric(15,2) NOT NULL CHECK (unit_cost >= 0),
  notes       text,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE app.petty_cash_voucher_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY petty_cash_voucher_items_tenant ON app.petty_cash_voucher_items
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Indexes
CREATE INDEX petty_cash_vouchers_tenant_status ON app.petty_cash_vouchers (tenant_id, status);
CREATE INDEX petty_cash_voucher_items_pcv ON app.petty_cash_voucher_items (pcv_id);

GRANT SELECT, INSERT, UPDATE ON app.petty_cash_vouchers TO amis_app;
GRANT SELECT, INSERT, UPDATE ON app.petty_cash_voucher_items TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS app.petty_cash_voucher_items;
DROP TABLE IF EXISTS app.petty_cash_vouchers;
