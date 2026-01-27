import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /:slug", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  it("should redirect to the target URL", async () => {
    const slug = `test-${nanoid()}`;
    const createRes = await client.api.links.$post(
      {
        json: {
          url: "https://example.com/destination",
          slug,
        },
      },
      { headers: authHeaders }
    );

    expect(createRes.status).toBe(201);

    // Redirect doesn't require auth
    const res = await client[":slug"].$get({
      param: { slug },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/destination");
  });

  it("should return 404 for non-existent slug", async () => {
    // Redirect doesn't require auth
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
