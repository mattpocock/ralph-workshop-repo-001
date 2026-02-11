import { testClient } from "hono/testing";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createApp } from "./app.js";
import { schema } from "./db/schema.js";

describe("POST /api/links", () => {
  let db: InstanceType<typeof Database>;
  let client: ReturnType<typeof testClient<ReturnType<typeof createApp>>>;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const app = createApp(db);
    client = testClient(app);
  });

  afterEach(() => {
    db.close();
  });

  it("should create a link with auto-generated slug", async () => {
    const res = await client.api.links.$post({
      json: { url: "https://example.com" },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.targetUrl).toBe("https://example.com");
    expect(body.slug).toMatch(/^[a-z0-9]{7}$/);
    expect(body.shortUrl).toContain(body.slug as string);
    expect(body.hasPassword).toBe(false);
    expect(body.tags).toEqual([]);
    expect(body.id).toBeDefined();
  });

  it("should create a link with custom slug", async () => {
    const res = await client.api.links.$post({
      json: { url: "https://example.com", slug: "my-link" },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe("my-link");
  });

  it("should reject duplicate slugs", async () => {
    await client.api.links.$post({
      json: { url: "https://example.com", slug: "taken" },
    });

    const res = await client.api.links.$post({
      json: { url: "https://other.com", slug: "taken" },
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("CONFLICT");
  });

  it("should reject invalid URL", async () => {
    const res = await client.api.links.$post({
      json: { url: "not-a-url" },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("should reject slug shorter than 3 chars", async () => {
    const res = await client.api.links.$post({
      json: { url: "https://example.com", slug: "ab" },
    });

    expect(res.status).toBe(400);
  });

  it("should reject slug with invalid characters", async () => {
    const res = await client.api.links.$post({
      json: { url: "https://example.com", slug: "UPPER_CASE!" },
    });

    expect(res.status).toBe(400);
  });
});
