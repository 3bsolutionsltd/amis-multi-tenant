/**
 * UVTAB / Ugandan convention: SURNAME comes first, followed by first_name,
 * then other_names.  e.g. "OCHIENG Stephen John"
 *
 * Use this everywhere student names are displayed in the application so that
 * the format is consistent with UVTAB / EIMS expectations.
 */
export interface StudentNameFields {
  first_name?: string | null;
  last_name?: string | null;
  other_names?: string | null;
}

/**
 * Returns the student name in UVTAB format: SURNAME Firstname [Other_names]
 * The surname is rendered in ALL-CAPS to match official UVTAB documents.
 *
 * @example
 * formatStudentName({ first_name: "Stephen", last_name: "Ochieng", other_names: "John" })
 * // "OCHIENG Stephen John"
 */
export function formatStudentName(s: StudentNameFields): string {
  const surname = (s.last_name ?? "").trim().toUpperCase();
  const first = (s.first_name ?? "").trim();
  const other = (s.other_names ?? "").trim();

  const parts = [surname, first, other].filter(Boolean);
  return parts.join(" ");
}
