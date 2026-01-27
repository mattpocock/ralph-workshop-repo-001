import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

describe("GET /api/tags", () => {
  const client = testClient(app);

  it("should return empty list when no tags exist", async () => {
    const res = await client.api.tags.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("tags");
    expect(Array.isArray(body.tags)).toBe(true);
  });

  it("should return tag with id and name", async () => {
    const tagName = `tag-list-${Date.now()}`;

    // Create a tag
    const createTagRes = await client.api.tags.$post({
      json: { name: tagName },
    });
    expect(createTagRes.status).toBe(201);
    const createdTag = await createTagRes.json();

    // Get tags list
    const res = await client.api.tags.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    const foundTag = body.tags.find((t: { name: string }) => t.name === tagName);
    expect(foundTag).toBeDefined();
    if (!foundTag || !("id" in createdTag)) throw new Error("Tag not found");
    expect(foundTag.id).toBe(createdTag.id);
    expect(foundTag.name).toBe(tagName);
    expect(foundTag.linkCount).toBe(0);
  });

  it("should return linkCount of 0 for tags with no links", async () => {
    const tagName = `orphan-tag-${Date.now()}`;

    // Create a tag without any links
    const createTagRes = await client.api.tags.$post({
      json: { name: tagName },
    });
    expect(createTagRes.status).toBe(201);

    // Get tags list
    const res = await client.api.tags.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    const foundTag = body.tags.find((t: { name: string }) => t.name === tagName);
    expect(foundTag).toBeDefined();
    if (!foundTag) throw new Error("Tag not found");
    expect(foundTag.linkCount).toBe(0);
  });
});

describe("POST /api/tags", () => {
  const client = testClient(app);

  it("should create a tag", async () => {
    const tagName = `tag-${Date.now()}`;
    const res = await client.api.tags.$post({
      json: {
        name: tagName,
      },
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      name: tagName,
    });
  });

  it("should return 400 for invalid tag name", async () => {
    const res = await client.api.tags.$post({
      json: {
        name: "",
      },
    });

    expect(res.status).toBe(400);
  });

  it("should return 409 for duplicate tag name", async () => {
    const tagName = `dup-tag-${Date.now()}`;

    // Create tag first time
    await client.api.tags.$post({
      json: { name: tagName },
    });

    // Try to create same tag again
    const res = await client.api.tags.$post({
      json: { name: tagName },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      error: expect.any(String),
      code: "CONFLICT",
    });
  });
});
