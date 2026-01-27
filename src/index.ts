import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { getDatabase } from "./db/index.ts";
import { createLinkSchema } from "./schemas/link.ts";

const BASE_URL = process.env["BASE_URL"] || "http://localhost:3000";

const app = new Hono()
  .get("/api/health", (c) => {
    return c.json({ status: "ok" });
  })
  .post("/api/links", zValidator("json", createLinkSchema), (c) => {
    const body = c.req.valid("json");
    const db = getDatabase();

    const id = nanoid();
    const slug = body.slug || nanoid(7);
    const now = Date.now();

    db.prepare(`
      INSERT INTO links (id, slug, target_url, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, slug, body.url, body.expiresAt || null, now, now);

    return c.json(
      {
        id,
        slug,
        shortUrl: `${BASE_URL}/${slug}`,
        targetUrl: body.url,
        expiresAt: body.expiresAt || null,
        hasPassword: false,
        tags: body.tags || [],
        createdAt: now,
        updatedAt: now,
      },
      201
    );
  });

const port = parseInt(process.env["PORT"] || "3000", 10);

if (process.env["NODE_ENV"] !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

export default app;
