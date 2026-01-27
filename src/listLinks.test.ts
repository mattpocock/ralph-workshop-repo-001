import { describe, it, expect, beforeAll, assert } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /api/links", () => {
  const client = testClient(app);

  it("should return empty array when no links exist", async () => {
    const res = await client.api.links.$get({
      query: {},
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    assert("links" in body);
    expect(body.links).toBeInstanceOf(Array);
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("should return created links with pagination", async () => {
    // Create a few links with unique slugs
    const slug1 = `list-test-${nanoid()}`;
    const slug2 = `list-test-${nanoid()}`;

    await client.api.links.$post({
      json: { url: "https://example1.com", slug: slug1 },
    });
    await client.api.links.$post({
      json: { url: "https://example2.com", slug: slug2 },
    });

    const res = await client.api.links.$get({
      query: {},
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    assert("links" in body);
    expect(body.links.length).toBeGreaterThanOrEqual(2);

    // Check link shape
    const link = body.links.find(
      (l: { slug: string }) => l.slug === slug1 || l.slug === slug2
    );
    expect(link).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      shortUrl: expect.any(String),
      targetUrl: expect.any(String),
      hasPassword: expect.any(Boolean),
      tags: expect.any(Array),
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it("should paginate results with page and limit params", async () => {
    // Create 3 links
    for (let i = 0; i < 3; i++) {
      await client.api.links.$post({
        json: { url: `https://paginate-test-${i}.com`, slug: `paginate-${nanoid()}` },
      });
    }

    const res = await client.api.links.$get({
      query: { page: "1", limit: "2" },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    assert("links" in body);
    expect(body.links.length).toBeLessThanOrEqual(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
  });

  it("should filter links by tag", async () => {
    // Create a tag first
    const tagName = `filter-tag-${nanoid()}`;
    await client.api.tags.$post({
      json: { name: tagName },
    });

    // Create a link with the tag
    const slugWithTag = `with-tag-${nanoid()}`;
    await client.api.links.$post({
      json: { url: "https://tagged.com", slug: slugWithTag, tags: [tagName] },
    });

    // Create a link without the tag
    const slugWithoutTag = `no-tag-${nanoid()}`;
    await client.api.links.$post({
      json: { url: "https://untagged.com", slug: slugWithoutTag },
    });

    const res = await client.api.links.$get({
      query: { tag: tagName },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    assert("links" in body);

    // Should only return the link with the tag
    const slugs = body.links.map((l: { slug: string }) => l.slug);
    expect(slugs).toContain(slugWithTag);
    expect(slugs).not.toContain(slugWithoutTag);
  });
});
