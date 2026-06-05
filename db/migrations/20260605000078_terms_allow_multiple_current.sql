-- migrate:up

-- ============================================================
-- Allow multiple concurrent "current" terms per tenant
--
-- The original partial unique index enforced exactly one current
-- term per tenant, but dual-programme institutions (e.g. UTC Kyema)
-- run Term-based and Semester-based programmes simultaneously.
-- Both tracks need an is_current = true term at the same time.
--
-- We drop the tenant-level uniqueness constraint and rely on
-- application queries (filtered by academic_year_id + is_current)
-- to locate the active term for a given programme track.
--
-- The academic_years_tenant_current_idx is intentionally kept —
-- there is still only one current academic year per tenant.
-- ============================================================

DROP INDEX IF EXISTS app.terms_tenant_current_idx;

-- migrate:down

CREATE UNIQUE INDEX terms_tenant_current_idx
  ON app.terms (tenant_id) WHERE is_current = true;
