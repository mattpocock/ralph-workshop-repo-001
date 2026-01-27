import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";

describe("POST /api/links", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  it("should create a link with auto-generated slug", async () => {
    const res = await client.api.links.$post(
      {
        json: {
          url: "https://example.com/very-long-url",
        },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      shortUrl: expect.stringContaining(body.slug),
      targetUrl: "https://example.com/very-long-url",
      hasPassword: false,
      tags: [],
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });
});
