export type ProgrammeRef = {
  id: string;
  code: string;
  title: string;
};

type Queryable = {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function resolveProgramme(
  client: Queryable,
  input: {
    programme_id?: string | null;
    programme_code?: string | null;
    programme?: string | null;
  },
): Promise<ProgrammeRef | null> {
  const programmeId = clean(input.programme_id);
  const programmeCode = clean(input.programme_code);
  const programme = clean(input.programme);

  if (!programmeId && !programmeCode && !programme) return null;

  const { rows } = await client.query<ProgrammeRef>(
    `SELECT id, code, title
     FROM app.programmes
     WHERE is_active = true
       AND (
         ($1::uuid IS NOT NULL AND id = $1::uuid)
         OR ($2::text IS NOT NULL AND lower(code) = lower($2::text))
         OR ($3::text IS NOT NULL AND (lower(code) = lower($3::text) OR lower(title) = lower($3::text)))
       )
     ORDER BY
       CASE
         WHEN $1::uuid IS NOT NULL AND id = $1::uuid THEN 1
         WHEN $2::text IS NOT NULL AND lower(code) = lower($2::text) THEN 2
         WHEN $3::text IS NOT NULL AND lower(code) = lower($3::text) THEN 3
         ELSE 4
       END
     LIMIT 1`,
    [programmeId, programmeCode, programme],
  );

  return rows[0] ?? null;
}