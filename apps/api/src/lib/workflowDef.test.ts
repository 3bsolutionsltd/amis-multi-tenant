import { describe, it, expect } from "vitest";
import { DEFAULT_WORKFLOWS } from "./workflowDef.js";

// Regression test for GitHub issue #180:
// DEFAULT_WORKFLOWS used key "admission" (singular) while all application code
// and the workflow engine use "admissions" (plural). This caused GET /workflows/admissions
// to return 404, preventing workflow transitions and enrollment.

describe("DEFAULT_WORKFLOWS", () => {
  describe("admissions workflow", () => {
    it('has an "admissions" key (plural)', () => {
      expect(DEFAULT_WORKFLOWS).toHaveProperty("admissions");
    });

    it('does not have an "admission" key (singular) — regression guard', () => {
      expect(DEFAULT_WORKFLOWS).not.toHaveProperty("admission");
    });

    it('has key field set to "admissions"', () => {
      expect(DEFAULT_WORKFLOWS.admissions.key).toBe("admissions");
    });

    it('initial_state is "submitted"', () => {
      expect(DEFAULT_WORKFLOWS.admissions.initial_state).toBe("submitted");
    });

    it('includes "admitted" state to allow enrollment', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).toContain("admitted");
    });

    it('does not include "accepted" state (renamed to "admitted")', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).not.toContain("accepted");
    });

    it('has a transition that leads to "admitted" state', () => {
      const toAdmitted = DEFAULT_WORKFLOWS.admissions.transitions.find(
        (t) => t.to === "admitted",
      );
      expect(toAdmitted).toBeDefined();
    });

    it('includes "rejected" state', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).toContain("rejected");
    });
  });
});
