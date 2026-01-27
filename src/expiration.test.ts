import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("Link expiration", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  describe("GET /:slug with expired link", () => {
    it("should return 410 Gone when link is expired", async () => {
      const slug = `exp-${nanoid()}`;
      const pastTimestamp = Date.now() - 1000; // 1 second ago

      await client.api.links.$post(
        {
          json: {
            url: "https://example.com/expired",
            slug,
            expiresAt: pastTimestamp,
          },
        },
        { headers: authHeaders }
      );

      // Redirect doesn't require auth
      const res = await client[":slug"].$get({
        param: { slug },
      });

      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Link expired",
        code: "GONE",
      });
    });

    it("should redirect when link is not yet expired", async () => {
      const slug = `exp-${nanoid()}`;
      const futureTimestamp = Date.now() + 60000; // 1 minute from now

      await client.api.links.$post(
        {
          json: {
            url: "https://example.com/not-expired",
            slug,
            expiresAt: futureTimestamp,
          },
        },
        { headers: authHeaders }
      );

      // Redirect doesn't require auth
      const res = await app.request(`/${slug}`);

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(
        "https://example.com/not-expired"
      );
    });

    it("should redirect when link has no expiration", async () => {
      const slug = `exp-${nanoid()}`;

      await client.api.links.$post(
        {
          json: {
            url: "https://example.com/no-expiry",
            slug,
          },
        },
        { headers: authHeaders }
      );

      // Redirect doesn't require auth
      const res = await app.request(`/${slug}`);

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("https://example.com/no-expiry");
    });
  });
});
