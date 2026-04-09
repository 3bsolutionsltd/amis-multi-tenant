import { z } from "zod";

export const CreateApplicationSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  programme: z.string().min(1),
  intake: z.string().min(1),
  dob: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  sponsorship_type: z.string().optional(),
  extension: z.record(z.unknown()).optional(),
});

export const ApplicationsQuerySchema = z.object({
  intake: z.string().optional(),
  programme: z.string().optional(),
  current_state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateApplication = z.infer<typeof CreateApplicationSchema>;
export type ApplicationsQuery = z.infer<typeof ApplicationsQuerySchema>;
