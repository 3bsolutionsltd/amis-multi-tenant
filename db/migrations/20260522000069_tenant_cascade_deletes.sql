-- migrate:up

-- Fix: Add ON DELETE CASCADE to all FK constraints referencing platform.tenants(id)
-- that are missing it. Without CASCADE, deleting a tenant fails with a FK
-- constraint violation → 500 error.
--
-- Uses a dynamic DO block so that any future tables added without CASCADE will
-- also be caught if this migration is re-applied (safe to run multiple times
-- because DROP CONSTRAINT + ADD CONSTRAINT is idempotent for the constraint
-- definition, and the loop only targets non-cascade constraints).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON  tc.constraint_name  = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON  rc.unique_constraint_name  = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.constraint_schema
    JOIN information_schema.key_column_usage kcu
      ON  tc.constraint_name  = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'platform'
      AND ccu.table_name   = 'tenants'
      AND ccu.column_name  = 'id'
      AND rc.delete_rule  != 'CASCADE'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I'
      '  DROP CONSTRAINT %I,'
      '  ADD  CONSTRAINT %I FOREIGN KEY (%I)'
      '    REFERENCES platform.tenants(id) ON DELETE CASCADE',
      r.table_schema, r.table_name, r.constraint_name,
      r.constraint_name, r.column_name
    );
    RAISE NOTICE 'Added ON DELETE CASCADE to %.%.%',
      r.table_schema, r.table_name, r.column_name;
  END LOOP;
END $$;

-- migrate:down
-- Intentionally empty: reverting per-table delete rules retrospectively is not
-- practical and would risk breaking existing data integrity assumptions.
