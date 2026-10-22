import { describe, expect, it } from "vitest";
import {
  applyGovernmentFeePolicy,
  getStudentFeeCategories,
} from "./feeCategories.js";

describe("Government fee categories", () => {
  it("does not match a Government student's residence tier", () => {
    expect(getStudentFeeCategories("boarding", "Government")).toEqual([
      "all",
      "government",
    ]);
  });

  it("uses the residence category instead of a non-Government sponsorship label", () => {
    expect(getStudentFeeCategories("day", "Private")).toEqual(["all", "day"]);
  });

  it("uses Government tuition, avoids duplicate all-tier fees, and applies allowed other fee types", () => {
    const feeStructures = [
      { id: "government-tuition", fee_type: "tuition", student_category: "government", term_id: "term-1" },
      { id: "boarding-tuition", fee_type: "tuition", student_category: "boarding", term_id: "term-1" },
      { id: "all-tuition", fee_type: "tuition", student_category: "all", term_id: "term-1" },
      { id: "government-guild", fee_type: "functional", student_category: "government", term_id: "term-1" },
      { id: "all-guild", fee_type: "functional", student_category: "all", term_id: "term-1" },
      { id: "all-exam", fee_type: "examination", student_category: "all", term_id: "term-1" },
    ];

    expect(
      applyGovernmentFeePolicy(feeStructures, "Government", ["functional"]).map(
        (line) => line.id,
      ),
    ).toEqual(["government-tuition", "government-guild"]);
  });

  it("defaults to all common non-tuition fees and permits tuition-only policy", () => {
    const feeStructures = [
      { id: "government-tuition", fee_type: "tuition", student_category: "government" },
      { id: "all-guild", fee_type: "functional", student_category: "all" },
      { id: "all-exam", fee_type: "examination", student_category: "all" },
    ];

    expect(
      applyGovernmentFeePolicy(feeStructures, "Government").map((line) => line.id),
    ).toEqual(["government-tuition", "all-guild", "all-exam"]);
    expect(
      applyGovernmentFeePolicy(feeStructures, "Government", []).map(
        (line) => line.id,
      ),
    ).toEqual(["government-tuition"]);
  });
});
