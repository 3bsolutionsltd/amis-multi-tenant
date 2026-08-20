-- migrate:up
-- Allow deleting mark_audit_log rows only when the parent submission is
-- still in DRAFT state (issue: DRAFT submissions with scores entered could
-- not be deleted because mark_audit_log's FK to mark_entries blocked it, and
-- mark_audit_log had no DELETE policy at all). Submissions past DRAFT remain
-- fully immutable/append-only as before.
CREATE POLICY tenant_isolation_delete_draft ON app.mark_audit_log
  FOR DELETE
  USING (
    tenant_id = app.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM app.workflow_instances wi
      WHERE wi.entity_type = 'marks'
        AND wi.entity_id = mark_audit_log.submission_id
        AND wi.current_state = 'DRAFT'
    )
  );

-- migrate:down
DROP POLICY IF EXISTS tenant_isolation_delete_draft ON app.mark_audit_log;
