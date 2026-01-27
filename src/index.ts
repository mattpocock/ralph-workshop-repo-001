import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { getDatabase } from "./db/index.ts";
import { createLinkSchema } from "./schemas/link.ts";
import { createTagSchema } from "./schemas/tag.ts";
import { updateClickGeo } from "./services/geo.ts";

const BASE_URL = process.env["BASE_URL"] || "http://localhost:3000";

const app = new Hono()
  .get("/api/health", (c) => {
    return c.json({ status: "ok" });
  })
  .post("/api/links", zValidator("json", createLinkSchema), async (c) => {
    const body = c.req.valid("json");
    const db = getDatabase();

    const id = nanoid();
    const slug = body.slug || nanoid(7);
    const now = Date.now();

    const passwordHash = body.password
      ? await bcrypt.hash(body.password, 10)
      : null;

    db.prepare(`
      INSERT INTO links (id, slug, target_url, password_hash, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, slug, body.url, passwordHash, body.expiresAt || null, now, now);

    return c.json(
      {
        id,
        slug,
        shortUrl: `${BASE_URL}/${slug}`,
        targetUrl: body.url,
        expiresAt: body.expiresAt || null,
        hasPassword: !!body.password,
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
  .get("/api/links/:id", (c) => {
    const id = c.req.param("id");
    const db = getDatabase();

    const link = db
      .prepare(
        "SELECT id, slug, target_url, password_hash, expires_at, created_at, updated_at FROM links WHERE id = ?"
      )
      .get(id) as
      | {
          id: string;
          slug: string;
          target_url: string;
          password_hash: string | null;
          expires_at: number | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    return c.json({
      id: link.id,
      slug: link.slug,
      shortUrl: `${BASE_URL}/${link.slug}`,
      targetUrl: link.target_url,
      expiresAt: link.expires_at,
      hasPassword: !!link.password_hash,
      tags: [],
      createdAt: link.created_at,
      updatedAt: link.updated_at,
    });
  })
  .post("/api/tags", zValidator("json", createTagSchema), (c) => {
    const body = c.req.valid("json");
    const db = getDatabase();

    const id = nanoid();

    try {
      db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(id, body.name);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        return c.json(
          { error: "Tag already exists", code: "CONFLICT" },
          409
        );
      }
      throw error;
    }

    return c.json({ id, name: body.name }, 201);
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = getDatabase();

    const link = db
      .prepare("SELECT id, target_url, password_hash, expires_at FROM links WHERE slug = ?")
      .get(slug) as
      | { id: string; target_url: string; password_hash: string | null; expires_at: number | null }
      | undefined;

    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    // Check expiration
    if (link.expires_at && link.expires_at < Date.now()) {
      return c.json({ error: "Link expired", code: "GONE" }, 410);
    }

    // Check password protection
    if (link.password_hash) {
      const password = c.req.query("password");
      if (!password) {
        return c.json(
          { error: "Password required", code: "UNAUTHORIZED" },
          401
        );
      }
      const isValid = await bcrypt.compare(password, link.password_hash);
      if (!isValid) {
        return c.json(
          { error: "Invalid password", code: "UNAUTHORIZED" },
          401
        );
      }
    }

    // Record click
    const clickId = nanoid();
    const timestamp = Date.now();
    const ip =
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null;
    const userAgent = c.req.header("user-agent") || null;
    const referrer = c.req.header("referer") || null;

    db.prepare(
      `INSERT INTO clicks (id, link_id, timestamp, ip, user_agent, referrer)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(clickId, link.id, timestamp, ip, userAgent, referrer);

    // Async geo lookup - fire and forget
    if (ip) {
      updateClickGeo(clickId, ip).catch(() => {
        // Silently ignore geo lookup failures
      });
    }

    return c.redirect(link.target_url, 302);
  });

const port = parseInt(process.env["PORT"] || "3000", 10);

if (process.env["NODE_ENV"] !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

export default app;
