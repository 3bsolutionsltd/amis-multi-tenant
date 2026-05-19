/**
 * Maps API conflict reason codes + entity type to user-facing message strings.
 *
 * Used by SyncConflictToast and any other UI that needs to surface sync
 * conflict information to the user.
 */

export type ConflictEntityType =
  | "marks"
  | "students"
  | "fees"
  | "config"
  | "admission_status"
  | string;

export interface ConflictEntry {
  eventId: string;
  entityType: ConflictEntityType;
  reason: string;
  serverValue: unknown;
}

export interface ConflictMessage {
  /** Short headline shown as the toast title. */
  title: string;
  /** Longer detail line shown below the title. */
  detail: string;
  /** "warning" for rejections, "success" for accepted edits. */
  severity: "warning" | "success" | "info";
}

/** Extract a human-readable score from the server value returned for marks. */
function extractScore(serverValue: unknown): string {
  if (
    serverValue !== null &&
    typeof serverValue === "object" &&
    "score" in (serverValue as Record<string, unknown>)
  ) {
    return String((serverValue as Record<string, unknown>).score);
  }
  return "unknown";
}

/**
 * Returns a user-facing message for a given conflict entry.
 *
 * @param entry - The conflict entry from the `/sync/flush` response, enriched
 *                with the original `entityType` from the client outbox event.
 */
export function getConflictMessage(entry: ConflictEntry): ConflictMessage {
  const { entityType, reason, serverValue } = entry;

  // ---- marks ---------------------------------------------------------------
  if (entityType === "marks") {
    if (reason === "server_version_newer") {
      const score = extractScore(serverValue);
      return {
        title: "Mark not saved",
        detail: `Server value: ${score} — your offline edit was not applied.`,
        severity: "warning",
      };
    }
    if (reason === "invalid_marks_payload") {
      return {
        title: "Invalid mark",
        detail: "The mark entry was incomplete and could not be saved.",
        severity: "warning",
      };
    }
  }

  // ---- students ------------------------------------------------------------
  if (entityType === "students") {
    if (reason === "delete_not_supported") {
      return {
        title: "Delete not supported offline",
        detail: "Student records cannot be deleted while offline.",
        severity: "warning",
      };
    }
    // students applied (LWW success) — caller passes reason "applied"
    if (reason === "applied") {
      return {
        title: "Edit saved",
        detail: "Your edit was accepted (last write wins).",
        severity: "success",
      };
    }
  }

  // ---- fees ----------------------------------------------------------------
  if (entityType === "fees") {
    return {
      title: "Fee record not saved",
      detail: "Server value retained — requires finance officer sign-off.",
      severity: "warning",
    };
  }

  // ---- config --------------------------------------------------------------
  if (entityType === "config" || reason === "config_immutable") {
    return {
      title: "Config change rejected",
      detail: "Config changes must use the draft→publish workflow.",
      severity: "warning",
    };
  }

  // ---- admission status ----------------------------------------------------
  if (entityType === "admission_status") {
    return {
      title: "Status change rejected",
      detail: "Admission status can only be changed server-side.",
      severity: "warning",
    };
  }

  // ---- fallback ------------------------------------------------------------
  return {
    title: "Sync conflict",
    detail: `Your offline change was not applied (reason: ${reason}).`,
    severity: "warning",
  };
}

/**
 * Convenience: returns messages for all conflicts in a flush response.
 *
 * @param conflicts  - The `conflicts` array from `POST /sync/flush`.
 * @param eventIndex - Map of eventId → entityType, built from the original
 *                     outbox events that were sent in the flush request.
 */
export function getConflictMessages(
  conflicts: Array<{ eventId: string; reason: string; serverValue: unknown }>,
  eventIndex: Map<string, ConflictEntityType>,
): ConflictMessage[] {
  return conflicts.map((c) =>
    getConflictMessage({
      ...c,
      entityType: eventIndex.get(c.eventId) ?? "unknown",
    }),
  );
}
