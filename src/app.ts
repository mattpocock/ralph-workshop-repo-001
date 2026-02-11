import { Hono } from "hono";
import type Database from "better-sqlite3";
import { z } from "zod";
import { nanoid, customAlphabet } from "nanoid";

const generateSlug = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

const createLinkSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "URL must use http or https"
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(3)
    .max(50)
    .optional(),
});

export function createApp(db: Database.Database) {
  return new Hono()
    .get("/api/health", (c) => {
      return c.json({ status: "ok" });
    })
    .post("/api/links", async (c) => {
      const body = await c.req.json();
      const parsed = createLinkSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            error: "Invalid request",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          },
          400
        );
      }

      const { url, slug: customSlug } = parsed.data;
      const id = nanoid();
      const slug = customSlug || generateSlug();
      const now = Date.now();

      try {
        db.prepare(
          "INSERT INTO links (id, slug, target_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).run(id, slug, url, now, now);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.message.includes("UNIQUE constraint failed: links.slug")
        ) {
          return c.json(
            { error: "Slug already exists", code: "CONFLICT" },
            409
          );
        }
        throw err;
      }

      const baseUrl = process.env["BASE_URL"] || "http://localhost:3000";

      return c.json(
        {
          id,
          slug,
          shortUrl: `${baseUrl}/${slug}`,
          targetUrl: url,
          expiresAt: null,
          hasPassword: false,
          tags: [],
          createdAt: now,
          updatedAt: now,
        },
        201
      );
    });
}
