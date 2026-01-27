import { z } from "zod";

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
});

export const createLinkSchema = z.object({
  url: z.string().url(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  expiresAt: z.number().int().positive().optional(),
  password: z.string().min(4).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateLinkSchema = z.object({
  url: z.string().url().optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  expiresAt: z.number().int().positive().optional(),
  password: z.string().min(4).optional(),
  tags: z.array(z.string()).optional(),
});
