import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { getDatabase } from "./db/index.ts";
import {
  createLinkSchema,
  updateLinkSchema,
  paginationSchema,
  qrQuerySchema,
} from "./schemas/link.ts";
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

    db.prepare(
      `
      INSERT INTO links (id, slug, target_url, password_hash, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, slug, body.url, passwordHash, body.expiresAt || null, now, now);

    // Associate tags with the link
    const tagNames = body.tags || [];
    if (tagNames.length > 0) {
      const insertLinkTag = db.prepare(
        "INSERT INTO link_tags (link_id, tag_id) VALUES (?, ?)"
      );
      const getTagId = db.prepare("SELECT id FROM tags WHERE name = ?");

      for (const tagName of tagNames) {
        const tag = getTagId.get(tagName) as { id: string } | undefined;
        if (tag) {
          insertLinkTag.run(id, tag.id);
        }
      }
    }

    return c.json(
      {
        id,
        slug,
        shortUrl: `${BASE_URL}/${slug}`,
        targetUrl: body.url,
        expiresAt: body.expiresAt || null,
        hasPassword: !!body.password,
        tags: tagNames,
        createdAt: now,
        updatedAt: now,
      },
      201
    );
  })
  .get("/api/links", (c) => {
    const db = getDatabase();
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const tag = c.req.query("tag");
    const offset = (page - 1) * limit;

    let countQuery = "SELECT COUNT(DISTINCT l.id) as total FROM links l";
    let selectQuery = `
      SELECT DISTINCT l.id, l.slug, l.target_url, l.password_hash, l.expires_at, l.created_at, l.updated_at
      FROM links l
    `;

    if (tag) {
      const joinClause =
        " INNER JOIN link_tags lt ON l.id = lt.link_id INNER JOIN tags t ON lt.tag_id = t.id WHERE t.name = ?";
      countQuery += joinClause;
      selectQuery += joinClause;
    }

    selectQuery += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";

    const totalResult = tag
      ? (db.prepare(countQuery).get(tag) as { total: number })
      : (db.prepare(countQuery).get() as { total: number });
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);

    const links = tag
      ? (db.prepare(selectQuery).all(tag, limit, offset) as Array<{
          id: string;
          slug: string;
          target_url: string;
          password_hash: string | null;
          expires_at: number | null;
          created_at: number;
          updated_at: number;
        }>)
      : (db.prepare(selectQuery).all(limit, offset) as Array<{
          id: string;
          slug: string;
          target_url: string;
          password_hash: string | null;
          expires_at: number | null;
          created_at: number;
          updated_at: number;
        }>);

    // Fetch tags for each link
    const getTagsStmt = db.prepare(
      `SELECT t.name FROM tags t
       INNER JOIN link_tags lt ON t.id = lt.tag_id
       WHERE lt.link_id = ?`
    );

    const formattedLinks = links.map((link) => {
      const tags = getTagsStmt.all(link.id) as Array<{ name: string }>;
      return {
        id: link.id,
        slug: link.slug,
        shortUrl: `${BASE_URL}/${link.slug}`,
        targetUrl: link.target_url,
        expiresAt: link.expires_at,
        hasPassword: !!link.password_hash,
        tags: tags.map((t) => t.name),
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      };
    });

    return c.json({
      links: formattedLinks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  })
  .get("/api/links/:id/stats", (c) => {
    const id = c.req.param("id");
    const db = getDatabase();

    const link = db.prepare("SELECT id FROM links WHERE id = ?").get(id);
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    // Total clicks
    const totalResult = db
      .prepare("SELECT COUNT(*) as total FROM clicks WHERE link_id = ?")
      .get(id) as { total: number };
    const totalClicks = totalResult.total;

    // Clicks by day
    const clicksByDay = db
      .prepare(
        `SELECT date(timestamp / 1000, 'unixepoch') as date, COUNT(*) as count
         FROM clicks WHERE link_id = ?
         GROUP BY date ORDER BY date DESC`
      )
      .all(id) as Array<{ date: string; count: number }>;

    // Clicks by country
    const clicksByCountry = db
      .prepare(
        `SELECT country, COUNT(*) as count
         FROM clicks WHERE link_id = ? AND country IS NOT NULL
         GROUP BY country ORDER BY count DESC`
      )
      .all(id) as Array<{ country: string; count: number }>;

    // Top referrers - aggregate by domain
    const rawReferrers = db
      .prepare(
        `SELECT referrer, COUNT(*) as count
         FROM clicks WHERE link_id = ?
         GROUP BY referrer ORDER BY count DESC`
      )
      .all(id) as Array<{ referrer: string | null; count: number }>;

    // Aggregate referrers by domain
    const referrerCounts = new Map<string, number>();
    for (const row of rawReferrers) {
      let domain = "direct";
      if (row.referrer) {
        try {
          domain = new URL(row.referrer).hostname;
        } catch {
          domain = row.referrer;
        }
      }
      referrerCounts.set(domain, (referrerCounts.get(domain) || 0) + row.count);
    }
    const topReferrers = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count);

    // Recent clicks
    const recentClicks = db
      .prepare(
        `SELECT timestamp, country, city, referrer
         FROM clicks WHERE link_id = ?
         ORDER BY timestamp DESC LIMIT 10`
      )
      .all(id) as Array<{
      timestamp: number;
      country: string | null;
      city: string | null;
      referrer: string | null;
    }>;

    return c.json({
      totalClicks,
      clicksByDay,
      clicksByCountry,
      topReferrers,
      recentClicks: recentClicks.map((click) => ({
        timestamp: click.timestamp,
        country: click.country,
        city: click.city,
        referrer: click.referrer,
      })),
    });
  })
  .get("/api/links/:id/clicks", zValidator("query", paginationSchema), (c) => {
    const id = c.req.param("id");
    const db = getDatabase();
    const { page, limit } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const link = db.prepare("SELECT id FROM links WHERE id = ?").get(id);
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    const totalResult = db
      .prepare("SELECT COUNT(*) as total FROM clicks WHERE link_id = ?")
      .get(id) as { total: number };
    const total = totalResult.total;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const clicks = db
      .prepare(
        `SELECT id, timestamp, ip, user_agent, referrer, country, city
         FROM clicks WHERE link_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      )
      .all(id, limit, offset) as Array<{
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
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  })
  .get("/api/links/:id/qr", zValidator("query", qrQuerySchema), async (c) => {
    const id = c.req.param("id");
    const db = getDatabase();
    const { size } = c.req.valid("query");

    const link = db.prepare("SELECT slug FROM links WHERE id = ?").get(id) as
      | { slug: string }
      | undefined;
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    const shortUrl = `${BASE_URL}/${link.slug}`;
    const qrBuffer = await QRCode.toBuffer(shortUrl, {
      width: size,
      type: "png",
    });

    return c.body(new Uint8Array(qrBuffer), 200, {
      "Content-Type": "image/png",
    });
  })
  .patch("/api/links/:id", zValidator("json", updateLinkSchema), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = getDatabase();

    const link = db
      .prepare("SELECT id, slug FROM links WHERE id = ?")
      .get(id) as { id: string; slug: string } | undefined;
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    const now = Date.now();
    const updates: string[] = ["updated_at = ?"];
    const values: (string | number | null)[] = [now];

    if (body.url !== undefined) {
      updates.push("target_url = ?");
      values.push(body.url);
    }

    if (body.slug !== undefined) {
      // Check for duplicate slug
      const existingSlug = db
        .prepare("SELECT id FROM links WHERE slug = ? AND id != ?")
        .get(body.slug, id);
      if (existingSlug) {
        return c.json({ error: "Slug already exists", code: "CONFLICT" }, 409);
      }
      updates.push("slug = ?");
      values.push(body.slug);
    }

    if (body.expiresAt !== undefined) {
      updates.push("expires_at = ?");
      values.push(body.expiresAt);
    }

    if (body.password !== undefined) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      updates.push("password_hash = ?");
      values.push(passwordHash);
    }

    values.push(id);
    db.prepare(`UPDATE links SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values
    );

    // Handle tags update
    if (body.tags !== undefined) {
      // Remove existing tag associations
      db.prepare("DELETE FROM link_tags WHERE link_id = ?").run(id);

      // Add new tag associations
      if (body.tags.length > 0) {
        const insertLinkTag = db.prepare(
          "INSERT INTO link_tags (link_id, tag_id) VALUES (?, ?)"
        );
        const getTagId = db.prepare("SELECT id FROM tags WHERE name = ?");

        for (const tagName of body.tags) {
          const tag = getTagId.get(tagName) as { id: string } | undefined;
          if (tag) {
            insertLinkTag.run(id, tag.id);
          }
        }
      }
    }

    // Fetch the updated link
    const updatedLink = db
      .prepare(
        "SELECT id, slug, target_url, password_hash, expires_at, created_at, updated_at FROM links WHERE id = ?"
      )
      .get(id) as {
      id: string;
      slug: string;
      target_url: string;
      password_hash: string | null;
      expires_at: number | null;
      created_at: number;
      updated_at: number;
    };

    // Fetch tags for this link
    const tags = db
      .prepare(
        `SELECT t.name FROM tags t
         INNER JOIN link_tags lt ON t.id = lt.tag_id
         WHERE lt.link_id = ?`
      )
      .all(id) as Array<{ name: string }>;

    return c.json({
      id: updatedLink.id,
      slug: updatedLink.slug,
      shortUrl: `${BASE_URL}/${updatedLink.slug}`,
      targetUrl: updatedLink.target_url,
      expiresAt: updatedLink.expires_at,
      hasPassword: !!updatedLink.password_hash,
      tags: tags.map((t) => t.name),
      createdAt: updatedLink.created_at,
      updatedAt: updatedLink.updated_at,
    });
  })
  .delete("/api/links/:id", (c) => {
    const id = c.req.param("id");
    const db = getDatabase();

    const link = db.prepare("SELECT id FROM links WHERE id = ?").get(id);
    if (!link) {
      return c.json({ error: "Link not found", code: "NOT_FOUND" }, 404);
    }

    db.prepare("DELETE FROM links WHERE id = ?").run(id);

    return c.body(null, 204);
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

    // Fetch tags for this link
    const tags = db
      .prepare(
        `SELECT t.name FROM tags t
         INNER JOIN link_tags lt ON t.id = lt.tag_id
         WHERE lt.link_id = ?`
      )
      .all(id) as Array<{ name: string }>;

    return c.json({
      id: link.id,
      slug: link.slug,
      shortUrl: `${BASE_URL}/${link.slug}`,
      targetUrl: link.target_url,
      expiresAt: link.expires_at,
      hasPassword: !!link.password_hash,
      tags: tags.map((t) => t.name),
      createdAt: link.created_at,
      updatedAt: link.updated_at,
    });
  })
  .get("/api/tags", (c) => {
    const db = getDatabase();

    const tags = db
      .prepare(
        `SELECT t.id, t.name, COUNT(lt.link_id) as linkCount
         FROM tags t
         LEFT JOIN link_tags lt ON t.id = lt.tag_id
         GROUP BY t.id, t.name`
      )
      .all() as Array<{ id: string; name: string; linkCount: number }>;

    return c.json({ tags });
  })
  .post("/api/tags", zValidator("json", createTagSchema), (c) => {
    const body = c.req.valid("json");
    const db = getDatabase();

    const id = nanoid();

    try {
      db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(
        id,
        body.name
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        return c.json({ error: "Tag already exists", code: "CONFLICT" }, 409);
      }
      throw error;
    }

    return c.json({ id, name: body.name }, 201);
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = getDatabase();

    const link = db
      .prepare(
        "SELECT id, target_url, password_hash, expires_at FROM links WHERE slug = ?"
      )
      .get(slug) as
      | {
          id: string;
          target_url: string;
          password_hash: string | null;
          expires_at: number | null;
        }
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
        return c.json({ error: "Invalid password", code: "UNAUTHORIZED" }, 401);
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
