-- migrate:up

-- 1. Track last successful login time
ALTER TABLE platform.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. IAM audit log — records every admin action on user accounts.
--    Stored in the platform schema; access is controlled entirely at the API
--    layer (superuser pool + explicit tenant_id filtering, same as other
--    platform.* tables). No RLS policy is needed here.
CREATE TABLE IF NOT EXISTS platform.iam_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL,
  actor_id      UUID,                   -- admin who performed the action (NULL = system)
  target_id     UUID        NOT NULL,   -- user account that was changed
  action        TEXT        NOT NULL,   -- created | role_changed | activated | deactivated | password_reset
  old_value     TEXT,                   -- previous value (e.g. old role)
  new_value     TEXT,                   -- new value (e.g. new role)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iam_audit_log_tenant_idx
  ON platform.iam_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS iam_audit_log_target_idx
  ON platform.iam_audit_log (target_id, created_at DESC);

-- migrate:down

DROP INDEX  IF EXISTS platform.iam_audit_log_target_idx;
DROP INDEX  IF EXISTS platform.iam_audit_log_tenant_idx;
DROP TABLE  IF EXISTS platform.iam_audit_log;
ALTER TABLE platform.users DROP COLUMN IF EXISTS last_login_at;
