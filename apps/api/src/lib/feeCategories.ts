export function getStudentFeeCategories(
  residenceCategory: string | null,
  sponsorshipType: string | null,
): string[] {
  const categories = new Set(["all"]);
  const residence = residenceCategory?.trim().toLowerCase();
  if (residence) categories.add(residence);

  const sponsorship = sponsorshipType?.trim().toLowerCase();
  if (sponsorship) {
    categories.add(sponsorship);
    if (sponsorship.includes("government")) categories.add("government");
    if (sponsorship.includes("private")) categories.add("private");
    if (sponsorship.includes("boarding") || sponsorship.includes("boarder")) categories.add("boarding");
    if (sponsorship.includes("day")) categories.add("day");
  }

  return [...categories];
}
