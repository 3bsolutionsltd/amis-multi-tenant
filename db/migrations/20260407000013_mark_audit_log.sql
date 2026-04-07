-- migrate:up
-- Append-only audit log: SELECT and INSERT policies only.
-- No UPDATE or DELETE policy → those operations silently affect 0 rows
-- under RLS, enforcing immutability at the database layer.
CREATE TABLE app.mark_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  submission_id uuid        NOT NULL REFERENCES app.mark_submissions(id),
  entry_id      uuid        NOT NULL REFERENCES app.mark_entries(id),
  old_score     numeric,
  new_score     numeric     NOT NULL,
  actor_user_id uuid,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.mark_audit_log ENABLE ROW LEVEL SECURITY;

-- Only SELECT and INSERT are permitted (no UPDATE / DELETE policy = append-only)
CREATE POLICY tenant_isolation_select ON app.mark_audit_log
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_insert ON app.mark_audit_log
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- migrate:down
DROP TABLE IF EXISTS app.mark_audit_log;
