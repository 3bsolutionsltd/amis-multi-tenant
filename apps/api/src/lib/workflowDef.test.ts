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

    it('initial_state is "ADMITTED"', () => {
      expect(DEFAULT_WORKFLOWS.admissions.initial_state).toBe("ADMITTED");
    });

    it('includes "REGISTERED" state to allow enrollment', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).toContain("REGISTERED");
    });

    it('does not include legacy "accepted" state', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).not.toContain("accepted");
    });

    it('has a transition that leads to "REGISTERED" state', () => {
      const toRegistered = DEFAULT_WORKFLOWS.admissions.transitions.find(
        (t) => t.to === "REGISTERED",
      );
      expect(toRegistered).toBeDefined();
    });

    it('includes "WITHDRAWN" state', () => {
      expect(DEFAULT_WORKFLOWS.admissions.states).toContain("WITHDRAWN");
    });
  });
});
