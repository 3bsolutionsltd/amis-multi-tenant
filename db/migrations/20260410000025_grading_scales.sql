-- migrate:up

-- ============================================================
-- Grading Scales
-- ============================================================
CREATE TABLE app.grading_scales (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL,           -- e.g. 'UBTEB Standard', 'UTC Internal'
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX grading_scales_tenant_idx ON app.grading_scales (tenant_id);

-- Only one default grading scale per tenant
CREATE UNIQUE INDEX grading_scales_tenant_default_idx
  ON app.grading_scales (tenant_id) WHERE is_default = true;

ALTER TABLE app.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.grading_scales FORCE ROW LEVEL SECURITY;

CREATE POLICY grading_scales_tenant_isolation ON app.grading_scales
  USING (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON app.grading_scales TO amis_app;

-- ============================================================
-- Grade Boundaries (the letter-grade rules within a scale)
-- ============================================================
CREATE TABLE app.grade_boundaries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_scale_id uuid        NOT NULL REFERENCES app.grading_scales(id) ON DELETE CASCADE,
  grade_letter     text        NOT NULL,      -- e.g. 'D1' (Distinction 1)
  description      text        NULL,          -- e.g. 'Distinction'
  min_score        numeric     NOT NULL,
  max_score        numeric     NOT NULL,
  grade_point      numeric     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_boundaries_score_check CHECK (max_score >= min_score)
);

CREATE INDEX grade_boundaries_scale_idx ON app.grade_boundaries (grading_scale_id);

-- Unique grade letter per scale
CREATE UNIQUE INDEX grade_boundaries_scale_letter_idx
  ON app.grade_boundaries (grading_scale_id, grade_letter);

-- RLS is inherited through grading_scales ownership; but we add explicit policy
-- via a join-based approach for direct queries.
ALTER TABLE app.grade_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.grade_boundaries FORCE ROW LEVEL SECURITY;

CREATE POLICY grade_boundaries_tenant_isolation ON app.grade_boundaries
  USING (
    grading_scale_id IN (
      SELECT id FROM app.grading_scales
      WHERE tenant_id = app.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON app.grade_boundaries TO amis_app;

-- migrate:down

DROP POLICY IF EXISTS grade_boundaries_tenant_isolation ON app.grade_boundaries;
DROP TABLE IF EXISTS app.grade_boundaries;

DROP POLICY IF EXISTS grading_scales_tenant_isolation ON app.grading_scales;
DROP TABLE IF EXISTS app.grading_scales;
