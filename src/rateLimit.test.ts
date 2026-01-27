import { describe, it, expect, assert, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";
import { resetRateLimits } from "./middleware/rateLimit.ts";

describe("Rate Limiting Middleware", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
    resetRateLimits();
  });

  describe("authenticated endpoints (100 req/min per API key)", () => {
    it("should allow requests under the rate limit", async () => {
      // Make a few requests - should all succeed
      const res1 = await client.api.links.$get({}, { headers: authHeaders });
      const res2 = await client.api.links.$get({}, { headers: authHeaders });
      const res3 = await client.api.links.$get({}, { headers: authHeaders });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });

    it("should return 429 when rate limit is exceeded", async () => {
      // Make 101 requests - the 101st should be rate limited
      for (let i = 0; i < 100; i++) {
        await client.api.links.$get({}, { headers: authHeaders });
      }

      const res = await client.api.links.$get({}, { headers: authHeaders });

      expect(res.status).toBe(429);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.code).toBe("RATE_LIMITED");
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("should track rate limits per API key independently", async () => {
      // Create a second API key
      const createKeyRes = await client.api.keys.$post(
        { json: { name: "Second Key" } },
        { headers: authHeaders }
      );
      expect(createKeyRes.status).toBe(201);
      const keyBody = await createKeyRes.json();
      assert("key" in keyBody);
      const secondKeyHeaders = { Authorization: `Bearer ${keyBody.key}` };

      // Exhaust rate limit for first API key
      for (let i = 0; i < 100; i++) {
        await client.api.links.$get({}, { headers: authHeaders });
      }

      // First key should be rate limited
      const res1 = await client.api.links.$get({}, { headers: authHeaders });
      expect(res1.status).toBe(429);

      // Second key should still work
      const res2 = await client.api.links.$get(
        {},
        { headers: secondKeyHeaders }
      );
      expect(res2.status).toBe(200);
    });
  });

  describe("unauthenticated endpoints (20 req/min per IP)", () => {
    it("should allow redirect requests under the rate limit", async () => {
      // Create a link to redirect to
      const createRes = await client.api.links.$post(
        {
          json: { url: "https://example.com", slug: `rate-test-${Date.now()}` },
        },
        { headers: authHeaders }
      );
      expect(createRes.status).toBe(201);
      const linkBody = await createRes.json();
      assert("slug" in linkBody);

      // Make a few redirect requests - should succeed
      const res1 = await app.request(`/${linkBody.slug}`);
      const res2 = await app.request(`/${linkBody.slug}`);
      const res3 = await app.request(`/${linkBody.slug}`);

      expect(res1.status).toBe(302);
      expect(res2.status).toBe(302);
      expect(res3.status).toBe(302);
    });

    it("should return 429 for unauthenticated endpoints when IP limit exceeded", async () => {
      // Create a link to redirect to
      const createRes = await client.api.links.$post(
        {
          json: {
            url: "https://example.com",
            slug: `rate-ip-test-${Date.now()}`,
          },
        },
        { headers: authHeaders }
      );
      expect(createRes.status).toBe(201);
      const linkBody = await createRes.json();
      assert("slug" in linkBody);

      // Make 21 redirect requests - the 21st should be rate limited
      for (let i = 0; i < 20; i++) {
        await app.request(`/${linkBody.slug}`);
      }

      const res = await app.request(`/${linkBody.slug}`);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.code).toBe("RATE_LIMITED");
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("should allow health check without rate limiting", async () => {
      // Health check should always be accessible (not counted in rate limit)
      for (let i = 0; i < 25; i++) {
        const res = await client.api.health.$get();
        expect(res.status).toBe(200);
      }
    });
  });
});
