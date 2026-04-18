import { z } from "zod";

export const PublicApplySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  programme: z.string().min(1),
  intake: z.string().min(1),
  dob: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  sponsorship_type: z.string().optional(),
});

export type PublicApply = z.infer<typeof PublicApplySchema>;
