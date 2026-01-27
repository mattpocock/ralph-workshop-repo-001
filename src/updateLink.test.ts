import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("PATCH /api/links/:id", () => {
  const client = testClient(app);

  it("should update the target URL", async () => {
    // Create a link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/original",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Update the URL
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created.id },
      json: {
        url: "https://example.com/updated",
      },
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    assert("targetUrl" in updated);
    expect(updated.targetUrl).toBe("https://example.com/updated");
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it("should update the slug", async () => {
    // Create a link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/slug-test",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Update the slug with a unique value
    const newSlug = `new-custom-slug-${Date.now()}`;
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created.id },
      json: {
        slug: newSlug,
      },
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    assert("slug" in updated);
    expect(updated.slug).toBe(newSlug);
    expect(updated.shortUrl).toContain(newSlug);
  });

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].$patch({
      param: { id: "non-existent-id" },
      json: {
        url: "https://example.com/test",
      },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: "Link not found",
      code: "NOT_FOUND",
    });
  });

  it("should return 409 for duplicate slug", async () => {
    // Create first link with a custom slug
    const uniqueSlug = `unique-slug-${Date.now()}`;
    const createRes1 = await client.api.links.$post({
      json: {
        url: "https://example.com/first",
        slug: uniqueSlug,
      },
    });
    expect(createRes1.status).toBe(201);

    // Create second link
    const createRes2 = await client.api.links.$post({
      json: {
        url: "https://example.com/second",
      },
    });
    expect(createRes2.status).toBe(201);
    const created2 = await createRes2.json();

    // Try to update second link with the first link's slug
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created2.id },
      json: {
        slug: uniqueSlug,
      },
    });

    expect(updateRes.status).toBe(409);
    const body = await updateRes.json();
    expect(body).toEqual({
      error: "Slug already exists",
      code: "CONFLICT",
    });
  });

  it("should update the password", async () => {
    // Create a link without password with unique slug
    const slug = `pwd-test-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/password-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.hasPassword).toBe(false);

    // Update with a password
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created.id },
      json: {
        password: "newsecret",
      },
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    assert("hasPassword" in updated);
    expect(updated.hasPassword).toBe(true);

    // Verify the password works on redirect
    const redirectWithoutPass = await client[":slug"].$get({
      param: { slug },
    });
    expect(redirectWithoutPass.status).toBe(401);

    // Use app.request for query params
    const redirectWithPass = await app.request(`/${slug}?password=newsecret`);
    expect(redirectWithPass.status).toBe(302);
  });

  it("should update expiration", async () => {
    // Create a link without expiration
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/expiration-test",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.expiresAt).toBe(null);

    // Update with expiration
    const futureTime = Date.now() + 3600000; // 1 hour from now
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created.id },
      json: {
        expiresAt: futureTime,
      },
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    assert("expiresAt" in updated);
    expect(updated.expiresAt).toBe(futureTime);
  });

  it("should update tags", async () => {
    // Create tags first
    await client.api.tags.$post({ json: { name: "update-tag-1" } });
    await client.api.tags.$post({ json: { name: "update-tag-2" } });

    // Create a link with one tag
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/tags-test",
        tags: ["update-tag-1"],
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.tags).toEqual(["update-tag-1"]);

    // Update tags
    const updateRes = await client.api.links[":id"].$patch({
      param: { id: created.id },
      json: {
        tags: ["update-tag-2"],
      },
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    assert("tags" in updated);
    expect(updated.tags).toEqual(["update-tag-2"]);
  });
});
