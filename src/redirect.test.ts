import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /:slug", () => {
  const client = testClient(app);

  it("should redirect to the target URL", async () => {
    const slug = `test-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/destination",
        slug,
      },
    });

    expect(createRes.status).toBe(201);

    const res = await client[":slug"].$get({
      param: { slug },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/destination");
  });

  it("should return 404 for non-existent slug", async () => {
    const res = await client[":slug"].$get({
      param: { slug: "non-existent-slug" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      error: expect.any(String),
      code: "NOT_FOUND",
    });
  });
});
