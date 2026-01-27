import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

describe("GET /api/links/:id", () => {
  const client = testClient(app);

  it("should return a link by id", async () => {
    // First create a link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/get-link-test",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Then retrieve it by id
    const getRes = await client.api.links[":id"].$get({
      param: { id: created.id },
    });

    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body).toMatchObject({
      id: created.id,
      slug: created.slug,
      shortUrl: created.shortUrl,
      targetUrl: "https://example.com/get-link-test",
      hasPassword: false,
      tags: [],
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].$get({
      param: { id: "non-existent-id" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: "Link not found",
      code: "NOT_FOUND",
    });
  });

  it("should return hasPassword:true for password-protected links", async () => {
    // Create a password-protected link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/protected-get-test",
        password: "secret123",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Retrieve it
    const getRes = await client.api.links[":id"].$get({
      param: { id: created.id },
    });

    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body).toMatchObject({ hasPassword: true });
  });

  it("should return expiresAt when set", async () => {
    const expiresAt = Date.now() + 86400000; // 1 day from now

    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/expiring-get-test",
        expiresAt,
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const getRes = await client.api.links[":id"].$get({
      param: { id: created.id },
    });

    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body).toMatchObject({ expiresAt });
  });
});
