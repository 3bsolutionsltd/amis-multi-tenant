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
    // Full enrollment clearance chain based on the standard TVET enrolment process.
    // Each transition is locked to the role responsible for that step.
    initial_state: "REGISTERED",
    states: [
      "REGISTERED",
      "DOCS_VERIFIED",
      "FEE_PAID",
      "GUILD_FEE_VERIFIED",
      "ENROLLMENT_ENDORSED",
      "PPE_ISSUED",
      "HALL_ALLOCATED",
      "MEAL_CARD_ISSUED",
      "HOD_VERIFIED",
      "MEDICAL_CLEARED",
      "LIBRARY_CARD_ISSUED",
      "ONLINE_REGISTERED",
      "EXAM_ENROLLED",
    ],
    transitions: [
      // Academic Registrar verifies academic & ID documents
      { action: "verify_docs", from: "REGISTERED", to: "DOCS_VERIFIED", required_role: "registrar" },
      // Accounts Office verifies and records fee payment
      { action: "verify_payment", from: "DOCS_VERIFIED", to: "FEE_PAID", required_role: "finance" },
      // Dean of Students verifies guild fee pay slip
      { action: "verify_guild_fee", from: "FEE_PAID", to: "GUILD_FEE_VERIFIED", required_role: "dean" },
      // Dean of Students endorses enrollment
      { action: "endorse_enrollment", from: "GUILD_FEE_VERIFIED", to: "ENROLLMENT_ENDORSED", required_role: "dean" },
      // Asst. Inventory Officer issues PPE / cleaning items (new students)
      { action: "issue_ppe", from: "ENROLLMENT_ENDORSED", to: "PPE_ISSUED", required_role: "admin" },
      // Custodian allocates hall of residence
      { action: "allocate_hall", from: "PPE_ISSUED", to: "HALL_ALLOCATED", required_role: "admin" },
      // Catering Officer issues meal card
      { action: "issue_meal_card", from: "HALL_ALLOCATED", to: "MEAL_CARD_ISSUED", required_role: "admin" },
      // Head of Department checks training requirements & PPE
      { action: "hod_verify", from: "MEAL_CARD_ISSUED", to: "HOD_VERIFIED", required_role: "hod" },
      // College Nurse performs medical check
      { action: "medical_clear", from: "HOD_VERIFIED", to: "MEDICAL_CLEARED", required_role: "admin" },
      // Librarian issues library access card
      { action: "issue_library_card", from: "MEDICAL_CLEARED", to: "LIBRARY_CARD_ISSUED", required_role: "admin" },
      // ICT Technician guides online registration
      { action: "online_register", from: "LIBRARY_CARD_ISSUED", to: "ONLINE_REGISTERED", required_role: "admin" },
      // Academic Registrar verifies 80% tuition and enrolls for exams (final step)
      { action: "enroll_for_exams", from: "ONLINE_REGISTERED", to: "EXAM_ENROLLED", required_role: "registrar" },
    ],
  },
  marks: {
    key: "marks",
    initial_state: "DRAFT",
    states: ["DRAFT", "SUBMITTED", "HOD_REVIEW", "APPROVED", "PUBLISHED"],
    transitions: [
      { action: "submit", from: "DRAFT", to: "SUBMITTED", required_role: "instructor" },
      { action: "review", from: "SUBMITTED", to: "HOD_REVIEW", required_role: "hod" },
      { action: "approve", from: "HOD_REVIEW", to: "APPROVED", required_role: "hod" },
      { action: "return", from: "HOD_REVIEW", to: "DRAFT", required_role: "hod" },
      { action: "publish", from: "APPROVED", to: "PUBLISHED", required_role: "registrar" },
    ],
  },
  admissions: {
    key: "admissions",
    initial_state: "ADMITTED",
    states: ["ADMITTED", "REPORTED", "FEE_CLEARED", "REGISTERED", "ENROLLED", "WITHDRAWN"],
    transitions: [
      { action: "report_in", from: "ADMITTED", to: "REPORTED", roles: ["registrar", "admin"], label: "Mark as Reported" },
      { action: "clear_fees", from: "REPORTED", to: "FEE_CLEARED", roles: ["finance", "admin"], label: "Clear Fees" },
      { action: "register", from: "FEE_CLEARED", to: "REGISTERED", roles: ["registrar", "admin"], label: "Issue ID & Register" },
      { action: "enroll", from: "REGISTERED", to: "ENROLLED", roles: ["registrar", "admin"], label: "Enrol as Student" },
      { action: "withdraw", from: "ADMITTED", to: "WITHDRAWN", roles: ["registrar", "admin"], label: "Withdraw" },
      { action: "withdraw", from: "REPORTED", to: "WITHDRAWN", roles: ["registrar", "admin"], label: "Withdraw" },
      { action: "withdraw", from: "FEE_CLEARED", to: "WITHDRAWN", roles: ["registrar", "admin"], label: "Withdraw" },
    ],
  },
  purchase_requisition: {
    key: "purchase_requisition",
    initial_state: "draft",
    states: [
      "draft",
      "submitted",
      "hod_recommended",
      "principal_approved",
      "ordered",
      "rejected",
      "closed",
    ],
    transitions: [
      // Any authenticated staff can submit a draft PR for review
      { action: "submit", from: "draft", to: "submitted" },
      // HOD reviews submission and recommends or rejects
      { action: "hod_recommend", from: "submitted", to: "hod_recommended", required_role: "hod" },
      { action: "hod_reject", from: "submitted", to: "rejected", required_role: "hod" },
      // Principal reviews HOD-recommended PR and approves or rejects
      { action: "principal_approve", from: "hod_recommended", to: "principal_approved", required_role: "principal" },
      { action: "principal_reject", from: "hod_recommended", to: "rejected", required_role: "principal" },
      // Finance/Procurement converts approved PR to an LPO or rejects
      { action: "convert_to_lpo", from: "principal_approved", to: "ordered", required_role: "finance" },
      { action: "procurement_reject", from: "principal_approved", to: "rejected", required_role: "finance" },
      // Close out the PR (admin or finance can close)
      { action: "close", from: "rejected", to: "closed" },
      { action: "close_lpo", from: "ordered", to: "closed" },
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
