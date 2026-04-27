/**
 * In-app + email notification helpers.
 *
 * Notifications are created fire-and-forget after workflow transitions.
 * Each function runs its own withTenant transaction so a notification
 * failure never rolls back the primary business operation.
 *
 * Email sending requires SMTP env vars (see lib/mailer.ts). When SMTP is
 * not configured the mailer logs to stdout and continues gracefully.
 */

import { withTenant } from "../db/tenant.js";
import { sendMail, buildEmailHtml } from "./mailer.js";

interface PRData {
  id: string;
  pr_number: string;
  title: string;
  requested_by?: string | null;
}

interface NotifyTarget {
  roles?: string[];
  email?: string;
  title: string;
  body: string;
}

async function insertNotifications(
  tenantId: string,
  targets: NotifyTarget[],
  entityId: string,
  link: string,
  entityType = "purchase_requisition",
): Promise<void> {
  if (!targets.length) return;

  /** Collect {id, email} rows per target so we can send emails too. */
  const emailJobs: Array<{ email: string; title: string; body: string; link: string }> = [];

  await withTenant(tenantId, async (client) => {
    for (const target of targets) {
      const users = new Map<string, string>(); // userId → email

      if (target.roles?.length) {
        const { rows } = await client.query<{ id: string; email: string }>(
          `SELECT id, email FROM platform.users
           WHERE tenant_id = $1 AND role = ANY($2::text[]) AND is_active = true`,
          [tenantId, target.roles],
        );
        rows.forEach((r) => users.set(r.id, r.email));
      }

      if (target.email) {
        const { rows } = await client.query<{ id: string; email: string }>(
          `SELECT id, email FROM platform.users
           WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND is_active = true`,
          [tenantId, target.email],
        );
        rows.forEach((r) => users.set(r.id, r.email));
      }

      for (const [userId, userEmail] of users) {
        await client.query(
          `INSERT INTO app.notifications
             (user_id, tenant_id, title, body, entity_type, entity_id, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, tenantId, target.title, target.body, entityType, entityId, link],
        );
        emailJobs.push({ email: userEmail, title: target.title, body: target.body, link });
      }
    }
  });

  // Send emails outside the DB transaction (fire-and-forget, errors logged by sendMail)
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  for (const job of emailJobs) {
    sendMail({
      to: job.email,
      subject: job.title,
      html: buildEmailHtml(job.title, job.body, `${appBaseUrl}${job.link}`),
    }).catch(() => {/* already logged by sendMail */});
  }
}

/**
 * Create notifications for all relevant stakeholders when a PR transitions.
 * Call this after the PR UPDATE transaction has already committed.
 * Errors are logged but never propagated.
 */
export async function notifyPRTransition(
  tenantId: string,
  pr: PRData,
  fromStatus: string,
  toStatus: string,
): Promise<void> {
  const link = `/procurement/requisitions/${pr.id}`;
  const prRef = `PR ${pr.pr_number}: "${pr.title}"`;

  const targets: NotifyTarget[] = [];

  if (toStatus === "submitted") {
    // → Notify HOD: new PR needs recommendation
    targets.push({
      roles: ["hod"],
      title: "PR Submitted — Awaiting HOD Recommendation",
      body: `${prRef} has been submitted and requires your recommendation.`,
    });
  } else if (toStatus === "hod_recommended") {
    // → Notify Principal: approved by HOD, needs final approval
    targets.push({
      roles: ["principal"],
      title: "PR Recommended — Awaiting Principal Approval",
      body: `${prRef} has been recommended by HOD and requires your approval.`,
    });
    // → Notify requester: good progress
    if (pr.requested_by) {
      targets.push({
        email: pr.requested_by,
        title: "Your PR Was Recommended by HOD",
        body: `${prRef} has been recommended by the HOD and is awaiting Principal approval.`,
      });
    }
  } else if (toStatus === "principal_approved") {
    // → Notify Finance: ready for LPO
    targets.push({
      roles: ["finance", "admin"],
      title: "PR Approved — Ready for LPO Conversion",
      body: `${prRef} has been approved by the Principal and is ready for LPO conversion.`,
    });
    // → Notify requester
    if (pr.requested_by) {
      targets.push({
        email: pr.requested_by,
        title: "Your PR Was Approved by the Principal",
        body: `${prRef} was approved by the Principal. Finance will convert it to an LPO.`,
      });
    }
  } else if (toStatus === "ordered") {
    // → Notify Principal and HOD: LPO has been issued
    targets.push({
      roles: ["principal", "hod"],
      title: "LPO Issued",
      body: `${prRef} has been converted to an LPO by Finance.`,
    });
    // → Notify requester
    if (pr.requested_by) {
      targets.push({
        email: pr.requested_by,
        title: "LPO Issued for Your PR",
        body: `${prRef} has been converted to an LPO. The procurement is now in progress.`,
      });
    }
  } else if (toStatus === "rejected") {
    const rejectBy =
      fromStatus === "submitted"
        ? "HOD"
        : fromStatus === "hod_recommended"
          ? "Principal"
          : "Finance";
    // → Always notify requester
    if (pr.requested_by) {
      targets.push({
        email: pr.requested_by,
        title: `Your PR Was Rejected by ${rejectBy}`,
        body: `${prRef} was rejected by ${rejectBy}. Please review and resubmit if necessary.`,
      });
    }
    // → Notify HOD when Principal rejects
    if (fromStatus === "hod_recommended") {
      targets.push({
        roles: ["hod"],
        title: "PR Rejected by Principal",
        body: `${prRef} you recommended was rejected by the Principal.`,
      });
    }
    // → Notify Principal and HOD when Finance rejects
    if (fromStatus === "principal_approved") {
      targets.push({
        roles: ["principal", "hod"],
        title: "PR Rejected by Finance",
        body: `${prRef} was rejected by Finance after Principal approval.`,
      });
    }
  }

  if (!targets.length) return;

  await insertNotifications(tenantId, targets, pr.id, link);
}

// =============================================================================
// GRN NOTIFICATIONS
// =============================================================================

interface GRNData {
  id: string;
  grn_number: string;
  po_id: string;
}

/**
 * Notify relevant users when a GRN is confirmed (goods received).
 * Notifies Finance + Admin so they know stock has arrived.
 */
export async function notifyGRNConfirmed(
  tenantId: string,
  grn: GRNData,
): Promise<void> {
  const link = `/procurement/grns/${grn.id}`;
  await insertNotifications(
    tenantId,
    [
      {
        roles: ["finance", "admin"],
        title: "Goods Received — GRN Confirmed",
        body: `GRN ${grn.grn_number} has been confirmed. Goods have been received and stock updated.`,
      },
    ],
    grn.id,
    link,
    "grn",
  );
}

// =============================================================================
// STORE ISSUANCE NOTIFICATIONS
// =============================================================================

interface IssuanceData {
  id: string;
  issuance_number: string;
  issued_to: string;
  department?: string | null;
}

/**
 * Notify relevant users when a store issuance is issued (items dispatched).
 * Notifies HOD of the department so they know items are ready.
 */
export async function notifyIssuanceIssued(
  tenantId: string,
  issuance: IssuanceData,
): Promise<void> {
  const link = `/inventory/issuances/${issuance.id}`;
  const dept = issuance.department ? ` for ${issuance.department}` : "";

  await insertNotifications(
    tenantId,
    [
      {
        roles: ["hod", "registrar"],
        title: "Store Issuance Dispatched",
        body: `Issuance ${issuance.issuance_number}${dept} has been issued to "${issuance.issued_to}". Items are ready for collection.`,
      },
    ],
    issuance.id,
    link,
    "store_issuance",
  );
}
