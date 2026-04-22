import { z } from "zod";

export const ProcessResultsSchema = z.object({
  term_id: z.string().uuid(),
});

export type ProcessResults = z.infer<typeof ProcessResultsSchema>;
