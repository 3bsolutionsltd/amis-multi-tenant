import type { PoolClient } from "pg";
import type { WorkflowDefinition } from "../modules/config/config.schema.js";

/**
 * Load the published config for a tenant and extract the named workflow.
 * Returns null if no published config or the workflow key doesn't exist.
 */
export async function loadWorkflowDef(
  tid: string,
  key: string,
  client: PoolClient,
): Promise<WorkflowDefinition | null> {
  const { rows } = await client.query<{
    payload: { workflows?: Record<string, WorkflowDefinition> };
  }>(
    `SELECT payload FROM platform.config_versions
     WHERE tenant_id = $1 AND status = 'published'
     LIMIT 1`,
    [tid],
  );
  const config = rows[0];
  if (!config) return null;
  return config.payload?.workflows?.[key] ?? null;
}
