import { z } from "zod";

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9-]+$/),
});
