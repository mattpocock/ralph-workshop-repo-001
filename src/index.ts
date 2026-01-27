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
  })
  .get("/api/links/:id/clicks", (c) => {
    const id = c.req.param("id");
    const db = getDatabase();

    const link = db.prepare("SELECT id FROM links WHERE id = ?").get(id);
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    const clicks = db
      .prepare(
        `SELECT id, timestamp, ip, user_agent, referrer, country, city
         FROM clicks WHERE link_id = ? ORDER BY timestamp DESC`
      )
      .all(id) as Array<{
      id: string;
      timestamp: number;
      ip: string | null;
      user_agent: string | null;
      referrer: string | null;
      country: string | null;
      city: string | null;
    }>;

    return c.json({
      clicks: clicks.map((click) => ({
        id: click.id,
        timestamp: click.timestamp,
        ip: click.ip,
        userAgent: click.user_agent,
        referrer: click.referrer,
        country: click.country,
        city: click.city,
      })),
    });
  })
  .get("/:slug", (c) => {
    const slug = c.req.param("slug");
    const db = getDatabase();

    const link = db
      .prepare("SELECT id, target_url FROM links WHERE slug = ?")
      .get(slug) as { id: string; target_url: string } | undefined;

    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    // Record click
    const clickId = nanoid();
    const timestamp = Date.now();
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null;
    const userAgent = c.req.header("user-agent") || null;
    const referrer = c.req.header("referer") || null;

    db.prepare(
      `INSERT INTO clicks (id, link_id, timestamp, ip, user_agent, referrer)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(clickId, link.id, timestamp, ip, userAgent, referrer);

    return c.redirect(link.target_url, 302);
  });

const port = parseInt(process.env["PORT"] || "3000", 10);

if (process.env["NODE_ENV"] !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

export default app;
