import { describe, it, expect, assert, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";

describe("POST /api/links/bulk", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  it("should create multiple links at once", async () => {
    const res = await client.api.links.bulk.$post(
      {
        json: {
          links: [
            { url: "https://example1.com" },
            { url: "https://example2.com" },
            { url: "https://example3.com" },
          ],
        },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    assert("created" in body);
    expect(body.created).toHaveLength(3);
    expect(body.errors).toHaveLength(0);

    // Each created link should have id, slug, and shortUrl
    for (const link of body.created) {
      expect(link.id).toBeDefined();
      expect(link.slug).toBeDefined();
      expect(link.shortUrl).toContain(link.slug);
    }
  });

  it("should support custom slugs in bulk creation", async () => {
    const customSlug1 = `bulk-custom-${Date.now()}-1`;
    const customSlug2 = `bulk-custom-${Date.now()}-2`;

    const res = await client.api.links.bulk.$post(
      {
        json: {
          links: [
            { url: "https://example1.com", slug: customSlug1 },
            { url: "https://example2.com", slug: customSlug2 },
          ],
        },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    assert("created" in body);
    expect(body.created).toHaveLength(2);
    expect(body.created[0]?.slug).toBe(customSlug1);
    expect(body.created[1]?.slug).toBe(customSlug2);
  });

  it("should return errors for duplicate slugs", async () => {
    const duplicateSlug = `duplicate-bulk-${Date.now()}`;

    // First create a link with the slug
    await client.api.links.$post(
      {
        json: {
          url: "https://existing.com",
          slug: duplicateSlug,
        },
      },
      { headers: authHeaders }
    );

    // Try bulk create with the same slug
    const res = await client.api.links.bulk.$post(
      {
        json: {
          links: [
            { url: "https://example1.com" },
            { url: "https://example2.com", slug: duplicateSlug },
            { url: "https://example3.com" },
          ],
        },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    assert("created" in body);
    assert("errors" in body);

    // Two links should succeed, one should fail
    expect(body.created).toHaveLength(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]?.index).toBe(1);
    expect(body.errors[0]?.error).toContain("Slug already exists");
  });

  it("should handle validation errors in bulk creation", async () => {
    const res = await client.api.links.bulk.$post(
      {
        json: {
          links: [
            { url: "https://valid.com" },
            { url: "not-a-valid-url" },
            { url: "https://also-valid.com" },
          ],
        },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    assert("created" in body);
    assert("errors" in body);

    // Two links should succeed, one should fail
    expect(body.created).toHaveLength(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]?.index).toBe(1);
  });

  it("should require authentication", async () => {
    const res = await client.api.links.bulk.$post({
      json: {
        links: [{ url: "https://example.com" }],
      },
    });

    expect(res.status).toBe(401);
  });
});
