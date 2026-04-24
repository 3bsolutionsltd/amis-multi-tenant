import type { PoolClient } from "pg";
import type { WorkflowDefinition } from "../modules/config/config.schema.js";

/**
 * Built-in default workflow definitions used when a tenant has no published config
 * or their config doesn't define the workflow. This ensures the system works
 * out of the box without requiring admin configuration.
 */
export const DEFAULT_WORKFLOWS: Record<string, WorkflowDefinition> = {
  term_registration: {
    key: "term_registration",
    initial_state: "REGISTRATION_STARTED",
    states: ["REGISTRATION_STARTED", "FEE_PAID", "CLEARED", "COMPLETED"],
    transitions: [
      { action: "pay_fees", from: "REGISTRATION_STARTED", to: "FEE_PAID" },
      { action: "clear", from: "FEE_PAID", to: "CLEARED" },
      { action: "complete", from: "CLEARED", to: "COMPLETED" },
    ],
  },
  marks: {
    key: "marks",
    initial_state: "DRAFT",
    states: ["DRAFT", "SUBMITTED", "HOD_REVIEW", "APPROVED", "PUBLISHED"],
    transitions: [
      { action: "submit", from: "DRAFT", to: "SUBMITTED" },
      { action: "review", from: "SUBMITTED", to: "HOD_REVIEW" },
      { action: "approve", from: "HOD_REVIEW", to: "APPROVED" },
      { action: "return", from: "HOD_REVIEW", to: "DRAFT" },
      { action: "publish", from: "APPROVED", to: "PUBLISHED" },
    ],
  },
  admission: {
    key: "admission",
    initial_state: "submitted",
    states: ["submitted", "shortlisted", "interview", "accepted", "rejected"],
    transitions: [
      { action: "shortlist", from: "submitted", to: "shortlisted" },
      { action: "interview", from: "shortlisted", to: "interview" },
      { action: "accept", from: "interview", to: "accepted" },
      { action: "reject", from: "interview", to: "rejected" },
    ],
  },
};

/**
 * Load the published config for a tenant and extract the named workflow.
 * Falls back to DEFAULT_WORKFLOWS if no published config or workflow key not found.
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
  const fromConfig = config?.payload?.workflows?.[key] ?? null;
  return fromConfig ?? DEFAULT_WORKFLOWS[key] ?? null;
}
