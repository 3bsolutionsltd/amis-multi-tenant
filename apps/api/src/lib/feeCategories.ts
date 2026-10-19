export function getStudentFeeCategories(
  residenceCategory: string | null,
  sponsorshipType: string | null,
): string[] {
  const sponsorship = sponsorshipType?.trim().toLowerCase();
  if (sponsorship?.includes("government")) return ["all", "government"];

  const categories = new Set(["all"]);
  const residence = residenceCategory?.trim().toLowerCase();
  if (residence) {
    categories.add(residence);
    return [...categories];
  }

  if (sponsorship) {
    categories.add(sponsorship);
    if (sponsorship.includes("private")) categories.add("private");
    if (sponsorship.includes("boarding") || sponsorship.includes("boarder")) categories.add("boarding");
    if (sponsorship.includes("day")) categories.add("day");
  }

  return [...categories];
}

export function isGovernmentSponsorship(sponsorshipType: string | null) {
  return sponsorshipType?.trim().toLowerCase().includes("government") ?? false;
}

export function isTuitionFeeType(feeType: string) {
  return feeType.trim().toLowerCase().includes("tuition");
}

export type CategorizedFeeStructure = {
  fee_type: string;
  student_category: string;
  term_id?: string | null;
};

export const GOVERNMENT_TUITION_CONFIGURATION_ERROR =
  "Government tuition fee structure is not configured for this student's programme. Add an active Government tuition fee structure before calculating fees.";

export function applyGovernmentFeePolicy<T extends CategorizedFeeStructure>(
  feeStructures: T[],
  sponsorshipType: string | null,
  governmentOtherFeeTypes?: readonly string[],
): T[] {
  if (!isGovernmentSponsorship(sponsorshipType)) return feeStructures;

  const allowedOtherFeeTypes =
    governmentOtherFeeTypes === undefined
      ? null
      : new Set(governmentOtherFeeTypes.map((feeType) => feeType.trim().toLowerCase()));
  const governmentFeePeriods = new Set(
    feeStructures
      .filter((line) => line.student_category.trim().toLowerCase() === "government")
      .map((line) => `${line.fee_type.trim().toLowerCase()}|${line.term_id ?? ""}`),
  );

  return feeStructures.filter((line) => {
    const category = line.student_category.trim().toLowerCase();
    const feeType = line.fee_type.trim().toLowerCase();
    if (category !== "government" && category !== "all") return false;

    if (isTuitionFeeType(feeType)) return category === "government";
    if (allowedOtherFeeTypes && !allowedOtherFeeTypes.has(feeType)) return false;
    if (category === "government") return true;

    return !governmentFeePeriods.has(`${feeType}|${line.term_id ?? ""}`);
  });
}
