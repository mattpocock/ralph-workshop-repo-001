import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

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
