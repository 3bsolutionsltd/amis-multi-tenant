-- migrate:up

-- ────────────────────────────────────────────────────────────────────────────
-- Performance indexes for Wave-2 gap #30  (SR-NF-003)
-- ────────────────────────────────────────────────────────────────────────────

-- payments: fast lookup by tenant
CREATE INDEX IF NOT EXISTS payments_tenant_id_idx
  ON app.payments (tenant_id);

-- payments: fast lookup by student
CREATE INDEX IF NOT EXISTS payments_student_id_idx
  ON app.payments (student_id);

-- admission_applications: fast lookup by tenant
CREATE INDEX IF NOT EXISTS admission_applications_tenant_id_idx
  ON app.admission_applications (tenant_id);

-- students: trigram-free name search for ILIKE queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS students_name_trgm_idx
  ON app.students
  USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- migrate:down

DROP INDEX IF EXISTS app.students_name_trgm_idx;
DROP INDEX IF EXISTS app.admission_applications_tenant_id_idx;
DROP INDEX IF EXISTS app.payments_student_id_idx;
DROP INDEX IF EXISTS app.payments_tenant_id_idx;
